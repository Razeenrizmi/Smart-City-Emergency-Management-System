import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config/app_config.dart';
import '../models/api_response.dart';
import '../models/cctv_node.dart';
import '../models/detection_config.dart';
import '../models/detection_log.dart';
import '../models/scan_result.dart';
import '../services/cctv_service.dart';
import '../services/dashboard_service.dart';
import '../services/detection_service.dart';
import '../services/scan_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'alert_detail_screen.dart';

/// Detection-status presentation — ported from the web `LiveANPRMonitor`
/// STATUS_CONFIG. Colours and labels never invent a result.
class _StatusUi {
  final Color color;
  final String label;

  const _StatusUi(this.color, this.label);
}

const Map<String, _StatusUi> _statusUi = {
  'IDLE': _StatusUi(AppPalette.offline, 'IDLE'),
  'ANALYZING': _StatusUi(AppPalette.accent, 'ANALYZING'),
  'NO_VEHICLE': _StatusUi(AppPalette.textMuted, 'NO VEHICLE'),
  'PERSON_DETECTED': _StatusUi(AppPalette.info, 'PERSON DETECTED'),
  'VEHICLE_DETECTED_NO_PLATE': _StatusUi(AppPalette.warning, 'NO PLATE'),
  'PLATE_UNREADABLE': _StatusUi(AppPalette.warning, 'PLATE UNREADABLE'),
  'AWAITING_CONFIRMATION': _StatusUi(AppPalette.offline, 'CONFIRMING'),
  'NO_CRIME_MATCH': _StatusUi(AppPalette.online, 'CLEARED'),
  'POSSIBLE_CRIME_MATCH': _StatusUi(AppPalette.danger, 'CRIME MATCH'),
  'COOLDOWN_SUPPRESSED': _StatusUi(AppPalette.warning, 'COOLDOWN'),
  'AI_SERVICE_UNAVAILABLE': _StatusUi(AppPalette.danger, 'AI OFFLINE'),
  'ERROR': _StatusUi(AppPalette.danger, 'ERROR'),
};

/// Live CCTV monitor for THIS device's camera.
///
/// Real `CameraPreview` + guarded frame capture at the backend-configured AI
/// sample rate (default 5 FPS / 200 ms) → `POST /api/crime-vehicle/scan` —
/// the exact same pipeline the web LiveANPRMonitor feeds. No second backend.
class LiveCameraScreen extends StatefulWidget {
  final int? preselectedNodeId;

  const LiveCameraScreen({super.key, this.preselectedNodeId});

  @override
  State<LiveCameraScreen> createState() => _LiveCameraScreenState();
}

class _LiveCameraScreenState extends State<LiveCameraScreen> {
  List<CctvNode> _nodes = [];
  int? _nodeId;
  DetectionConfig? _config;
  bool _loading = true;
  String? _loadError;

  CameraController? _controller;
  bool _cameraActive = false;
  bool _initializingCamera = false;
  String? _cameraError;

  bool _monitoring = false;
  bool _analyzing = false;
  String _sessionId = '';

  ScanResult? _latest;
  String? _scanError;
  double? _aiFps;
  double? _lastProcessingMs;
  int? _lastFrameNumber;
  int _activeTracks = 0;
  int _processedTracks = 0;
  int _crimeCount = 0;
  final List<DateTime> _aiStamps = [];

  List<DetectionLog> _recent = [];

  Timer? _scanTimer;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(AppConfig.pollInterval, (_) => _refresh());
  }

  @override
  void dispose() {
    _scanTimer?.cancel();
    _pollTimer?.cancel();
    final sessionId = _sessionId;
    if (sessionId.isNotEmpty) {
      ScanService.instance.endSession(sessionId);
    }
    final nodeId = _nodeId;
    if (nodeId != null && _cameraActive) {
      CctvService.instance.stopNode(nodeId);
    }
    final controller = _controller;
    _controller = null;
    controller?.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Backend data
  // ---------------------------------------------------------------------------

  int get _frameIntervalMs {
    final cfg = _config;
    if (cfg == null) return AppConfig.fallbackFrameIntervalMs;
    if (cfg.targetAiFps > 0) return (1000 / cfg.targetAiFps).round();
    return cfg.frameIntervalMs > 0
        ? cfg.frameIntervalMs
        : AppConfig.fallbackFrameIntervalMs;
  }

  int get _targetAiFps {
    final cfg = _config;
    if (cfg != null && cfg.targetAiFps > 0) return cfg.targetAiFps;
    return AppConfig.fallbackTargetAiFps;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final nodes = await CctvService.instance.getNodes();
      DetectionConfig? config;
      try {
        config = await DashboardService.instance.getConfig();
      } catch (_) {
        config = null;
      }
      if (!mounted) return;
      setState(() {
        _nodes = nodes;
        _config = config;
        _nodeId ??= _resolveDefaultNode(nodes);
        _loading = false;
        _loadError = null;
      });
      await _refreshRecent();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.toString();
        _loading = false;
      });
    }
  }

  int? _resolveDefaultNode(List<CctvNode> nodes) {
    if (widget.preselectedNodeId != null &&
        nodes.any((n) => n.nodeId == widget.preselectedNodeId)) {
      return widget.preselectedNodeId;
    }
    if (_nodeId != null && nodes.any((n) => n.nodeId == _nodeId)) {
      return _nodeId;
    }
    for (final n in nodes) {
      if (n.cameraType == 'MOBILE_CAMERA' || n.streamSource == 'PHONE_CAMERA') {
        return n.nodeId;
      }
    }
    return nodes.isNotEmpty ? nodes.first.nodeId : null;
  }

  Future<void> _refresh() async {
    final nodeId = _nodeId;
    try {
      final nodes = await CctvService.instance.getNodes();
      if (mounted) {
        setState(() {
          _nodes = nodes;
          _nodeId ??= _resolveDefaultNode(nodes);
        });
      }
    } catch (_) {
      // Polite polling — keep the last known list.
    }
    if (nodeId != null) await _refreshRecent();
  }

  Future<void> _refreshRecent() async {
    final nodeId = _nodeId;
    if (nodeId == null) return;
    try {
      final logs =
          await DetectionService.instance.getHistory(nodeId: nodeId, limit: 15);
      if (mounted) setState(() => _recent = logs);
    } catch (_) {
      // Polite polling — keep the last known detections.
    }
  }

  /// Best-effort status push — mirrors web `cctvService.setNodeStatus`
  /// (failures are logged server-side, never crash the monitor).
  Future<void> _reportStatus(String status) async {
    final nodeId = _nodeId;
    if (nodeId == null) return;
    try {
      await CctvService.instance.setNodeStatus(nodeId, status);
    } catch (_) {
      // Backend unreachable — node state will resync on next successful push.
    }
  }

  String get _runtimeStatus {
    if (_cameraError != null && !_cameraActive) return 'ERROR';
    if (!_cameraActive) return _serverStatus;
    if (_monitoring && _analyzing) return 'ANALYZING';
    return 'ONLINE';
  }

  String get _serverStatus {
    final node = _nodes.where((n) => n.nodeId == _nodeId).firstOrNull;
    return node?.status ?? 'OFFLINE';
  }

  // ---------------------------------------------------------------------------
  // Camera lifecycle
  // ---------------------------------------------------------------------------

  Future<void> _startCamera() async {
    if (_initializingCamera || _cameraActive) return;
    setState(() {
      _initializingCamera = true;
      _cameraError = null;
    });

    try {
      if (Platform.isAndroid) {
        var status = await Permission.camera.status;
        if (!status.isGranted) {
          status = await Permission.camera.request();
          if (!status.isGranted) {
            setState(() {
              _cameraError =
                  'Camera permission denied. Allow camera access in system '
                  'settings, then start the camera again.';
              _initializingCamera = false;
            });
            _reportStatus('ERROR');
            return;
          }
        }
      }

      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw CameraException(
          'NoCameraAvailable',
          'No camera available on this device.',
        );
      }
      final description = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        description,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await controller.initialize();

      if (!mounted) {
        await controller.dispose();
        return;
      }

      setState(() {
        _controller = controller;
        _cameraActive = true;
        _initializingCamera = false;
        _cameraError = null;
      });
      _reportStatus('ONLINE');
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(() {
        _cameraError = _friendlyCameraError(e);
        _initializingCamera = false;
        _cameraActive = false;
      });
      _reportStatus('ERROR');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _cameraError = 'Unable to open the camera: $e';
        _initializingCamera = false;
        _cameraActive = false;
      });
      _reportStatus('ERROR');
    }
  }

  String _friendlyCameraError(CameraException e) {
    final description = (e.description ?? '').toLowerCase();
    if (e.code.contains('permission') ||
        description.contains('permission') ||
        description.contains('denied')) {
      return 'Camera permission denied. Allow camera access in system '
          'settings, then start the camera again.';
    }
    if (e.code == 'NoCameraAvailable' || description.contains('no camera')) {
      return 'No camera available on this device.';
    }
    if (description.contains('in use') || e.code == 'CameraInUse') {
      return 'Camera is in use by another application.';
    }
    return 'Camera error: ${e.description ?? e.code}';
  }

  Future<void> _stopCamera() async {
    await _stopMonitoring();
    final controller = _controller;
    _controller = null;
    setState(() {
      _cameraActive = false;
      _cameraError = null;
    });
    try {
      await controller?.dispose();
    } catch (_) {
      // Controller may already be released by the platform.
    }
    final nodeId = _nodeId;
    if (nodeId != null) {
      try {
        await CctvService.instance.stopNode(nodeId);
      } catch (_) {
        _reportStatus('OFFLINE');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Monitoring lifecycle (session + capture loop)
  // ---------------------------------------------------------------------------

  Future<void> _startMonitoring() async {
    if (!_cameraActive || _monitoring || _nodeId == null) return;

    String sessionId;
    try {
      sessionId = await CctvService.instance.startNodeSession(_nodeId!);
    } catch (_) {
      // Backend down — local fallback so the capture loop still runs
      // (mirrors the web monitor's CCTV-{date}-{time}-N{id} fallback).
      final now = DateTime.now();
      final date = now.toString().substring(0, 10);
      final time = now
          .toString()
          .substring(11, 19)
          .replaceAll(':', '');
      sessionId = 'CCTV-$date-$time-N$_nodeId';
    }

    if (!mounted) return;
    setState(() {
      _sessionId = sessionId;
      _monitoring = true;
      _scanError = null;
      _latest = null;
      _aiFps = null;
      _lastProcessingMs = null;
      _lastFrameNumber = null;
      _activeTracks = 0;
      _processedTracks = 0;
      _crimeCount = 0;
      _aiStamps.clear();
    });
    _reportStatus('ONLINE');

    unawaited(_captureFrame());
    _scanTimer = Timer.periodic(Duration(milliseconds: _frameIntervalMs), (_) {
      if (!_analyzing) unawaited(_captureFrame());
    });
  }

  Future<void> _stopMonitoring() async {
    _scanTimer?.cancel();
    _scanTimer = null;
    final sessionId = _sessionId;
    _sessionId = '';
    if (sessionId.isNotEmpty) {
      await ScanService.instance.endSession(sessionId);
    }
    if (!mounted) return;
    setState(() {
      _monitoring = false;
      _analyzing = false;
    });
    if (_cameraActive) _reportStatus('ONLINE');
  }

  Future<void> _captureFrame() async {
    final controller = _controller;
    if (_analyzing ||
        controller == null ||
        !controller.value.isInitialized ||
        !_monitoring) {
      return;
    }

    setState(() {
      _analyzing = true;
      _scanError = null;
    });
    _reportStatus('ANALYZING');
    final started = DateTime.now();

    try {
      final file = await controller.takePicture();
      final bytes = await file.readAsBytes();

      final result = await ScanService.instance.scanFrame(
        jpegBytes: bytes,
        nodeId: _nodeId ?? 0,
        sessionId: _sessionId,
      );

      if (!mounted) return;
      _recordAiCompletion(result, DateTime.now().difference(started));
      setState(() {
        final tracking = result.trackingInfo;
        if (tracking != null) {
          _activeTracks = tracking.totalActiveTracks;
          _processedTracks = tracking.totalProcessedTracks;
        }
        // Crime count only for real new matches (cooldown re-sights excluded
        // server-side) — same rule as the web monitor.
        if (result.isMatch &&
            result.detectionStatus == 'POSSIBLE_CRIME_MATCH') {
          _crimeCount += 1;
        }
        if (result.shouldDisplay) _latest = result;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _scanError = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _scanError = 'Frame scan failed: $e');
    } finally {
      if (mounted) {
        setState(() => _analyzing = false);
        if (_cameraActive && _monitoring) _reportStatus('ONLINE');
      }
    }
  }

  /// Honest AI FPS: prefer server-measured `frameStats.aiFps`; fall back to a
  /// client window over real scan-completion timestamps. Never estimated.
  void _recordAiCompletion(ScanResult result, Duration clientElapsed) {
    final now = DateTime.now();
    _aiStamps.add(now);
    if (_aiStamps.length > 30) _aiStamps.removeAt(0);

    double? clientFps;
    if (_aiStamps.length >= 2) {
      final span =
          _aiStamps.last.difference(_aiStamps.first).inMicroseconds / 1e6;
      if (span > 0) clientFps = (_aiStamps.length - 1) / span;
    }

    final serverFps = result.frameStats?.aiFps ?? 0;
    setState(() {
      _aiFps = serverFps > 0 ? serverFps : clientFps;
      _lastProcessingMs = result.frameStats?.processingMs ??
          clientElapsed.inMicroseconds / 1000.0;
      _lastFrameNumber = result.frameStats?.frameNumber;
    });
  }

  // ---------------------------------------------------------------------------
  // Node switching
  // ---------------------------------------------------------------------------

  Future<void> _onNodeChanged(int newNodeId) async {
    if (newNodeId == _nodeId) return;
    final oldNodeId = _nodeId;
    if (_monitoring) await _stopMonitoring();

    setState(() {
      _nodeId = newNodeId;
      _latest = null;
      _scanError = null;
      _aiFps = null;
      _lastProcessingMs = null;
      _lastFrameNumber = null;
      _activeTracks = 0;
      _processedTracks = 0;
      _crimeCount = 0;
      _aiStamps.clear();
      _recent = [];
    });

    if (oldNodeId != null && _cameraActive) {
      try {
        await CctvService.instance.stopNode(oldNodeId);
      } catch (_) {
        // Old node state resyncs when the backend is reachable again.
      }
    }
    if (_cameraActive) _reportStatus('ONLINE');
    await _refreshRecent();
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    if (_loading && _nodes.isEmpty) {
      return const Scaffold(
        body: LoadingView(message: 'Loading CCTV nodes...'),
      );
    }
    if (_loadError != null && _nodes.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('LIVE CAMERA')),
        body: ErrorView(message: _loadError!, onRetry: _load),
      );
    }
    if (_nodes.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('LIVE CAMERA')),
        body: const EmptyView(
          message: 'No CCTV nodes registered on the backend.',
          icon: Icons.videocam_off,
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('LIVE CAMERA'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppPalette.accent,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _nodeSelectorCard(),
            const SizedBox(height: 12),
            _previewCard(),
            const SizedBox(height: 12),
            _controlsRow(),
            const SizedBox(height: 12),
            _statusRow(),
            if (_scanError != null) ...[
              const SizedBox(height: 10),
              _errorBanner(_scanError!),
            ],
            const SizedBox(height: 12),
            _metricsGrid(),
            const SizedBox(height: 16),
            if (_latest != null) ...[
              const Text(
                'LATEST AI RESULT',
                style: TextStyle(
                  color: AppPalette.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 8),
              _resultCard(_latest!),
              const SizedBox(height: 16),
            ],
            const Text(
              'RECENT DETECTIONS (BACKEND TRACK IDs)',
              style: TextStyle(
                color: AppPalette.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 8),
            if (_recent.isEmpty)
              const EmptyView(
                message: 'No detections recorded for this node yet.',
                icon: Icons.directions_car_outlined,
              )
            else
              ..._recent.map(_trackTile),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _nodeSelectorCard() {
    final selected = _nodes.where((n) => n.nodeId == _nodeId).firstOrNull;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            const Icon(Icons.cell_tower, size: 18, color: AppPalette.accent),
            const SizedBox(width: 10),
            Expanded(
              child: DropdownButtonHideUnderline(
                child: DropdownButton<int>(
                  value: _nodeId,
                  isExpanded: true,
                  dropdownColor: AppPalette.surface,
                  iconEnabledColor: AppPalette.accent,
                  style: const TextStyle(
                    color: AppPalette.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                  items: _nodes
                      .map(
                        (n) => DropdownMenuItem(
                          value: n.nodeId,
                          child: Text(
                            '${n.nodeLabel} · '
                            '${n.cameraName.isEmpty ? 'Unnamed camera' : n.cameraName}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (id) {
                    if (id != null) unawaited(_onNodeChanged(id));
                  },
                ),
              ),
            ),
            const SizedBox(width: 8),
            _nodeStatusChip(selected?.status ?? _runtimeStatus),
          ],
        ),
      ),
    );
  }

  Widget _nodeStatusChip(String status) {
    final color = switch (status.toUpperCase()) {
      'ONLINE' || 'ANALYZING' => AppPalette.online,
      'ERROR' => AppPalette.danger,
      'CONNECTING' => AppPalette.warning,
      _ => AppPalette.offline,
    };
    final label = switch (status.toUpperCase()) {
      'ANALYZING' => 'ANALYZING',
      'ONLINE' => 'ONLINE',
      'ERROR' => 'ERROR',
      'CONNECTING' => 'CONNECTING',
      _ => 'OFFLINE',
    };
    return StatusChip(label: label, color: color, pulse: color == AppPalette.online);
  }

  Widget _previewCard() {
    final controller = _controller;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: _previewBody(controller),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  _cameraActive ? Icons.videocam : Icons.videocam_off,
                  size: 14,
                  color: _cameraActive ? AppPalette.online : AppPalette.textMuted,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _cameraActive
                        ? 'DEVICE CAMERA · REAL PREVIEW · no fabricated feed'
                        : 'Camera is off — start the camera to go live.',
                    style: const TextStyle(
                      color: AppPalette.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _previewBody(CameraController? controller) {
    if (_initializingCamera) {
      return _Placeholder(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppPalette.accent),
            const SizedBox(height: 12),
            const Text(
              'Opening camera...',
              style: TextStyle(color: AppPalette.textMuted, fontSize: 12),
            ),
          ],
        ),
      );
    }
    if (_cameraError != null) {
      return _Placeholder(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography, color: AppPalette.danger, size: 34),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _cameraError!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppPalette.textMuted,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      );
    }
    if (_cameraActive && controller != null && controller.value.isInitialized) {
      return CameraPreview(controller);
    }
    return const _Placeholder(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.videocam_off, color: AppPalette.textMuted, size: 34),
          SizedBox(height: 10),
          Text(
            'Tap START CAMERA to use this device\nas a CCTV node.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppPalette.textMuted, fontSize: 12, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _controlsRow() {
    return Row(
      children: [
        Expanded(
          child: _cameraActive
              ? FilledButton.tonalIcon(
                  onPressed: _initializingCamera ? null : _stopCamera,
                  icon: const Icon(Icons.stop_circle_outlined),
                  label: const Text('STOP CAMERA'),
                )
              : FilledButton.icon(
                  onPressed: _initializingCamera ? null : _startCamera,
                  icon: const Icon(Icons.videocam),
                  label: Text(
                    _initializingCamera ? 'OPENING...' : 'START CAMERA',
                  ),
                ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _monitoring
              ? FilledButton.tonalIcon(
                  style: FilledButton.styleFrom(
                    foregroundColor: AppPalette.danger,
                  ),
                  onPressed: _stopMonitoring,
                  icon: const Icon(Icons.pause_circle_outlined),
                  label: const Text('STOP MONITORING'),
                )
              : FilledButton.icon(
                  onPressed: _cameraActive && !_initializingCamera
                      ? _startMonitoring
                      : null,
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('START MONITORING'),
                ),
        ),
      ],
    );
  }

  Widget _statusRow() {
    final status = _runtimeStatus;
    final statusCfg = _statusUi[status] ??
        const _StatusUi(AppPalette.offline, 'OFFLINE');
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            StatusChip(
              label: _monitoring && _analyzing ? 'ANALYZING' : statusCfg.label,
              color: _monitoring && _analyzing
                  ? AppPalette.accent
                  : statusCfg.color,
              pulse: _monitoring || _cameraActive,
            ),
            if (_analyzing) ...[
              const SizedBox(width: 8),
              const SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppPalette.accent,
                ),
              ),
            ],
            const Spacer(),
            Text(
              _sessionId.isEmpty ? 'no session' : _sessionId,
              style: const TextStyle(
                color: AppPalette.textMuted,
                fontSize: 10,
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
              decoration: BoxDecoration(
                color: AppPalette.accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppPalette.accent.withValues(alpha: 0.4),
                ),
              ),
              child: Text(
                '$_targetAiFps FPS',
                style: const TextStyle(
                  color: AppPalette.accent,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _errorBanner(String message) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppPalette.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppPalette.danger.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, size: 16, color: AppPalette.danger),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppPalette.danger, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricsGrid() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _metric(
                'Stream FPS',
                '—',
                AppPalette.offline,
                hint: 'no frame callback',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _metric(
                'AI FPS',
                _aiFps == null
                    ? '—'
                    : _aiFps!.toStringAsFixed(1),
                AppPalette.accent,
                hint: 'measured',
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _metric(
                'Tracks',
                '$_activeTracks/$_processedTracks',
                AppPalette.info,
                hint: 'active/processed',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _metric(
                'Crime hits',
                '$_crimeCount',
                AppPalette.danger,
                hint: 'new matches',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _metric(String label, String value, Color color, {String? hint}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(
                color: AppPalette.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (hint != null) ...[
              const SizedBox(height: 2),
              Text(
                hint,
                style: const TextStyle(
                  color: AppPalette.textMuted,
                  fontSize: 9,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _resultCard(ScanResult result) {
    final ui = _statusUi[result.detectionStatus] ??
        const _StatusUi(AppPalette.offline, 'IDLE');
    final crime = result.isMatch &&
        result.detectionStatus == 'POSSIBLE_CRIME_MATCH';

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: result.logId.isEmpty
            ? null
            : () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AlertDetailScreen(logId: result.logId),
                  ),
                ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  StatusChip(label: ui.label, color: ui.color, pulse: crime),
                  const Spacer(),
                  if (crime) StatusChip.alert(),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                result.detectedPlate.isEmpty
                    ? (result.vehicleType.isEmpty
                        ? 'No plate read yet'
                        : result.vehicleType)
                    : result.detectedPlate,
                style: TextStyle(
                  color: crime ? AppPalette.danger : AppPalette.text,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                [
                  if (result.vehicleType.isNotEmpty) result.vehicleType,
                  if (result.logId.isNotEmpty) result.logId,
                  if (_lastFrameNumber != null) 'frame #$_lastFrameNumber',
                  if (_lastProcessingMs != null)
                    '${_lastProcessingMs!.toStringAsFixed(0)} ms',
                ].join(' · '),
                style: const TextStyle(
                  color: AppPalette.textMuted,
                  fontSize: 11,
                ),
              ),
              if (result.vehicleInfo.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  result.vehicleInfo,
                  style: const TextStyle(
                    color: AppPalette.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
              if (result.matchedVehicle != null &&
                  result.matchedVehicle!.threatLevel.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'THREAT: ${result.matchedVehicle!.threatLevel}'
                  '${result.matchedVehicle!.incidentType.isEmpty ? '' : ' · ${result.matchedVehicle!.incidentType}'}',
                  style: const TextStyle(
                    color: AppPalette.danger,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              if (result.logId.isNotEmpty) ...[
                const SizedBox(height: 8),
                const Row(
                  children: [
                    Icon(
                      Icons.open_in_new,
                      size: 12,
                      color: AppPalette.accent,
                    ),
                    SizedBox(width: 4),
                    Text(
                      'Tap for full alert detail',
                      style: TextStyle(color: AppPalette.accent, fontSize: 11),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _trackTile(DetectionLog log) {
    final crime = log.isCrimeVehicle;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => AlertDetailScreen(logId: log.logId)),
        ),
        leading: CircleAvatar(
          backgroundColor:
              (crime ? AppPalette.danger : AppPalette.accent).withValues(alpha: 0.15),
          child: Text(
            log.trackId != null ? '${log.trackId}' : '?',
            style: TextStyle(
              color: crime ? AppPalette.danger : AppPalette.accent,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ),
        title: Text(
          [
            if (log.vehicleType.isNotEmpty) log.vehicleType,
            if (log.plateNumber.isNotEmpty) log.plateNumber,
          ].join(' · ').isEmpty
              ? (log.trackId != null ? 'Track #${log.trackId}' : 'Detection')
              : [
                  if (log.vehicleType.isNotEmpty) log.vehicleType,
                  if (log.plateNumber.isNotEmpty) log.plateNumber,
                ].join(' · '),
          style: const TextStyle(color: AppPalette.text, fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '${log.logId} · ${log.timePart} · ${log.status}',
          style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
        ),
        trailing: crime
            ? StatusChip.alert(label: 'CRIME')
            : StatusChip(label: 'TRACK', color: AppPalette.accent),
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  final Widget child;

  const _Placeholder({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 220,
      width: double.infinity,
      color: AppPalette.surface2,
      child: Center(child: child),
    );
  }
}
