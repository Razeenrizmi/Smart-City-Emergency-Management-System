import 'dart:async';

import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/cctv_node.dart';
import '../models/dashboard_stats.dart';
import '../models/detection_config.dart';
import '../models/detection_log.dart';
import '../services/cctv_service.dart';
import '../services/dashboard_service.dart';
import '../services/detection_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'alert_detail_screen.dart';
import 'live_camera_screen.dart';

/// Live CCTV detail for one backend node.
/// Shows status, honest FPS, recent backend tracks — never invents a video stream.
class CctvDetailScreen extends StatefulWidget {
  final int nodeId;

  const CctvDetailScreen({super.key, required this.nodeId});

  @override
  State<CctvDetailScreen> createState() => _CctvDetailScreenState();
}

class _CctvDetailScreenState extends State<CctvDetailScreen> {
  Timer? _timer;
  CctvNode? _node;
  DetectionConfig? _config;
  DashboardStats? _stats;
  List<DetectionLog> _recent = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(AppConfig.pollInterval, (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final results = await Future.wait([
        CctvService.instance.getNode(widget.nodeId),
        DashboardService.instance.getConfig(),
        DashboardService.instance.getStatistics(),
        DetectionService.instance.getHistory(nodeId: widget.nodeId, limit: 15),
      ]);
      if (!mounted) return;
      setState(() {
        _node = results[0] as CctvNode;
        _config = results[1] as DetectionConfig?;
        _stats = results[2] as DashboardStats;
        _recent = results[3] as List<DetectionLog>;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final node = _node;
    return Scaffold(
      appBar: AppBar(
        title: Text(node?.nodeLabel ?? 'NODE-${widget.nodeId}'),
        actions: [
          IconButton(onPressed: () => _load(), icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _body(node),
    );
  }

  Widget _body(CctvNode? node) {
    if (_loading && node == null) {
      return const LoadingView(message: 'Loading node monitor...');
    }
    if (_error != null && node == null) {
      return ErrorView(message: _error!, onRetry: () => _load());
    }
    if (node == null) {
      return const EmptyView(message: 'Node not found.');
    }

    final targetFps = _config?.targetAiFps ?? 5;
    final actualFps = _stats?.measuredFpsLabel ?? '—';
    final crimeOnNode = _recent.where((l) => l.isCrimeVehicle).length;
    final vehicleTracks = _recent
        .where((l) => l.trackId != null)
        .map((l) => l.trackId)
        .toSet()
        .length;

    return RefreshIndicator(
      color: AppPalette.accent,
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          node.cameraName,
                          style: const TextStyle(
                            color: AppPalette.text,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      node.isOnline ? StatusChip.online() : StatusChip.offline(),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    node.location,
                    style: const TextStyle(color: AppPalette.textMuted, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  _streamPanel(node),
                  const SizedBox(height: 12),
                  FilledButton.tonalIcon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) =>
                            LiveCameraScreen(preselectedNodeId: node.nodeId),
                      ),
                    ),
                    icon: const Icon(Icons.video_camera_front, size: 18),
                    label: const Text('OPEN LIVE CAMERA ON THIS DEVICE'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _metric('Status', node.status, _statusColor(node.status))),
              const SizedBox(width: 10),
              Expanded(child: _metric('Target AI FPS', '$targetFps', AppPalette.info)),
              const SizedBox(width: 10),
              Expanded(child: _metric('AI FPS', actualFps, AppPalette.accent)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _metric('Vehicles', '$vehicleTracks', AppPalette.accent)),
              const SizedBox(width: 10),
              Expanded(
                child: _metric('Crime', '$crimeOnNode', AppPalette.danger),
              ),
              const SizedBox(width: 10),
              Expanded(child: _metric('Tracks shown', '${_recent.length}', AppPalette.info)),
            ],
          ),
          const SizedBox(height: 16),
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
    );
  }

  Widget _streamPanel(CctvNode node) {
    // Real network/MJPEG URL only — never fabricate a camera feed.
    if (node.streamUrl.isNotEmpty &&
        (node.streamUrl.startsWith('http://') ||
            node.streamUrl.startsWith('https://') ||
            node.streamUrl.contains('/video') ||
            node.streamUrl.contains('mjpeg'))) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              node.streamUrl,
              height: 180,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _streamPlaceholder(
                'Stream URL configured but not reachable from this device.',
              ),
              loadingBuilder: (_, child, progress) {
                if (progress == null) return child;
                return SizedBox(
                  height: 180,
                  child: Center(
                    child: CircularProgressIndicator(
                      color: AppPalette.accent,
                      value: progress.expectedTotalBytes != null
                          ? progress.cumulativeBytesLoaded /
                              progress.expectedTotalBytes!
                          : null,
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Text(
            node.streamUrl,
            style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
          ),
        ],
      );
    }

    return _streamPlaceholder(
      node.isOnline
          ? 'Node is ONLINE.\nAI processing runs on the backend at ${_config?.targetAiFps ?? 5} FPS.\n'
              'Browser WebRTC/local webcam streams are not mobile-compatible — no fake video is shown.'
          : 'Node is OFFLINE.\nStart monitoring from the web dashboard to bring this camera online.',
    );
  }

  Widget _streamPlaceholder(String message) {
    return Container(
      height: 160,
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppPalette.surface2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppPalette.border),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_off, color: AppPalette.textMuted, size: 32),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppPalette.textMuted, fontSize: 12, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metric(String label, String value, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(color: AppPalette.textMuted, fontSize: 10, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ],
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
          backgroundColor: (crime ? AppPalette.danger : AppPalette.accent)
              .withValues(alpha: 0.15),
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

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'ONLINE':
      case 'ANALYZING':
        return AppPalette.online;
      case 'ERROR':
        return AppPalette.danger;
      case 'CONNECTING':
        return AppPalette.warning;
      default:
        return AppPalette.offline;
    }
  }
}
