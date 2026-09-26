import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:geolocator/geolocator.dart';
import '../models/hazard_report_model.dart';
import '../services/hazard_api_service.dart';
import '../services/location_service.dart';
import '../services/ai_api_service.dart';
import '../widgets/interactive_navigation_map.dart';

enum DetectionStatus { idle, monitoring, spikeDetected, reporting, reported, error }

class HazardDetectionScreen extends StatefulWidget {
  const HazardDetectionScreen({super.key});

  @override
  State<HazardDetectionScreen> createState() => _HazardDetectionScreenState();
}

class _HazardDetectionScreenState extends State<HazardDetectionScreen>
    with TickerProviderStateMixin {
  // --- Navigation & View Tab ---
  int _selectedViewTab = 0; // 0 = Google Navigation Map, 1 = Sensor Diagnostics & AI

  // --- State ---
  DetectionStatus _status = DetectionStatus.idle;
  double _currentZValue = 0.0;
  double _peakZSpike = 0.0;
  Position? _lastPosition;
  String _statusMessage = 'Tap "Start Monitoring" to begin';
  String? _lastReportId;
  bool _isMonitoring = false;
  bool _inCooldown = false;
  int _totalReports = 0;

  // --- AI State ---
  XFile? _selectedImage;
  AiClassificationResult? _aiResult;
  bool _isClassifying = false;

  // --- Subscriptions & timers ---
  StreamSubscription<AccelerometerEvent>? _accelSub;
  Timer? _cooldownTimer;

  // --- Animation controllers ---
  late AnimationController _pulseController;
  late AnimationController _alertController;
  late Animation<double> _pulseAnim;

  final ImagePicker _imagePicker = ImagePicker();

  // Spike threshold (lowered to 11.5 for easy testing; baseline gravity is ~9.8)
  static const double _spikeThreshold = 11.5;
  static const Duration _cooldownDuration = Duration(seconds: 5);

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _alertController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _pulseAnim = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _accelSub?.cancel();
    _cooldownTimer?.cancel();
    _pulseController.dispose();
    _alertController.dispose();
    super.dispose();
  }

  // ─── Start monitoring ───────────────────────────────────────────────
  Future<void> _startMonitoring() async {
    try {
      final position = await LocationService.getCurrentPosition();
      setState(() {
        _lastPosition = position;
        _status = DetectionStatus.monitoring;
        _isMonitoring = true;
        _peakZSpike = 0.0;
        _statusMessage = 'Monitoring... Drive over bumps to detect hazards';
      });

      _accelSub = accelerometerEventStream(
        samplingPeriod: SensorInterval.normalInterval,
      ).listen((event) {
        final absX = event.x.abs();
        final absY = event.y.abs();
        final absZ = event.z.abs();

        // Calculate max spike across all 3 axes (X, Y, Z) & 3D Magnitude
        final maxSpike = max(absX, max(absY, absZ));

        setState(() => _currentZValue = maxSpike);

        if (maxSpike > _spikeThreshold && !_inCooldown) {
          if (maxSpike > _peakZSpike) _peakZSpike = maxSpike;
          _triggerReport(maxSpike);
        }
      });
    } catch (e) {
      setState(() {
        _status = DetectionStatus.error;
        _statusMessage = 'Error: ${e.toString()}';
      });
    }
  }

  // ─── Stop monitoring ────────────────────────────────────────────────
  void _stopMonitoring() {
    _accelSub?.cancel();
    _accelSub = null;
    _cooldownTimer?.cancel();
    setState(() {
      _status = DetectionStatus.idle;
      _isMonitoring = false;
      _inCooldown = false;
      _currentZValue = 0.0;
      _statusMessage = 'Monitoring stopped. Tap "Start" to resume.';
    });
  }

  // ─── Trigger auto-report ────────────────────────────────────────────
  Future<void> _triggerReport(double zSpike) async {
    if (_inCooldown || _lastPosition == null) return;

    setState(() {
      _inCooldown = true;
      _status = DetectionStatus.spikeDetected;
      _statusMessage = 'Spike detected! Z = ${zSpike.toStringAsFixed(1)} m/s²';
    });

    _alertController.forward(from: 0.0);

    // Refresh GPS position
    try {
      final pos = await LocationService.getCurrentPosition();
      setState(() => _lastPosition = pos);
    } catch (_) {}

    await _sendReport(zSpike);

    // Cooldown
    _cooldownTimer = Timer(_cooldownDuration, () {
      if (mounted && _isMonitoring) {
        setState(() {
          _inCooldown = false;
          _status = DetectionStatus.monitoring;
          _statusMessage = 'Monitoring... Drive over bumps to detect hazards';
        });
      }
    });
  }

  // ─── Manual report ──────────────────────────────────────────────────
  Future<void> _manualReport() async {
    if (_lastPosition == null) {
      try {
        final pos = await LocationService.getCurrentPosition();
        setState(() => _lastPosition = pos);
      } catch (e) {
        _showSnack('Could not get location: $e', isError: true);
        return;
      }
    }
    await _sendReport(_currentZValue > 0 ? _currentZValue : 5.0);
  }

  // ─── Send to backend ────────────────────────────────────────────────
  Future<void> _sendReport(double zSpike) async {
    setState(() {
      _status = DetectionStatus.reporting;
      _statusMessage = 'Sending report to server...';
    });

    final report = HazardReportModel(
      latitude: _lastPosition!.latitude,
      longitude: _lastPosition!.longitude,
      accelerometerZSpike: zSpike,
    );

    final result = await HazardApiService.postHazardReport(report);

    if (result['success'] == true) {
      final data = result['data']['data'] ?? result['data'];
      final reportId = (data?['id'] ?? '').toString();
      setState(() {
        _status = DetectionStatus.reported;
        _totalReports++;
        _lastReportId = reportId;
        _statusMessage = 'Hazard reported successfully! ✅';
      });
      _showSnack('Report submitted! ID: ${_lastReportId ?? "N/A"}');

      // If an image was attached, immediately classify it
      if (_selectedImage != null && reportId.isNotEmpty) {
        await _classifyAttachedImage(reportId: reportId, zSpike: zSpike);
      }
    } else {
      setState(() {
        _status = _isMonitoring ? DetectionStatus.monitoring : DetectionStatus.error;
        _statusMessage = 'Failed: ${result['error']}';
      });
      _showSnack('Failed: ${result['error']}', isError: true);
    }
  }

  // ─── Photo picker ────────────────────────────────────────────────────
  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        imageQuality: 75,
        maxWidth: 1024,
      );
      if (picked == null) return;
      setState(() {
        _selectedImage = picked;
        _aiResult = null; // reset prior result
      });
      _showSnack('Photo attached. It will be AI-classified on next report.');
    } catch (e) {
      _showSnack('Could not pick image: $e', isError: true);
    }
  }

  void _showImagePickerDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 16),
              decoration: BoxDecoration(color: const Color(0xFF4A5568), borderRadius: BorderRadius.circular(2)),
            ),
            Text('Attach Hazard Photo', style: GoogleFonts.outfit(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            _sheetOption(Icons.camera_alt_rounded, 'Take Photo', () { Navigator.pop(ctx); _pickImage(ImageSource.camera); }),
            _sheetOption(Icons.photo_library_rounded, 'Choose from Gallery', () { Navigator.pop(ctx); _pickImage(ImageSource.gallery); }),
            if (_selectedImage != null)
              _sheetOption(Icons.delete_outline_rounded, 'Remove Photo', () {
                Navigator.pop(ctx);
                setState(() { _selectedImage = null; _aiResult = null; });
              }, color: const Color(0xFFE53E3E)),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _sheetOption(IconData icon, String label, VoidCallback onTap, {Color? color}) {
    final c = color ?? const Color(0xFF667EEA);
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: c.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: c, size: 20),
      ),
      title: Text(label, style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w500)),
      onTap: onTap,
    );
  }

  // ─── AI classify ─────────────────────────────────────────────────────
  Future<void> _classifyAttachedImage({String? reportId, double zSpike = 0.0}) async {
    if (_selectedImage == null) return;
    setState(() => _isClassifying = true);

    try {
      final bytes = await File(_selectedImage!.path).readAsBytes();
      final base64Image = base64Encode(bytes);

      final res = await AiApiService.classifyImage(
        imageBase64: base64Image,
        hazardReportId: reportId,
        accelerometerSpike: zSpike,
      );

      if (res['success'] == true) {
        final result = AiClassificationResult.fromJson(res['data'] as Map<String, dynamic>);
        setState(() => _aiResult = result);
        _showSnack(result.badgeText);
      } else {
        _showSnack('AI classification: ${res['error']}', isError: true);
      }
    } catch (e) {
      _showSnack('AI error: $e', isError: true);
    } finally {
      setState(() => _isClassifying = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.outfit()),
        backgroundColor: isError ? const Color(0xFFE53E3E) : const Color(0xFF38A169),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  // ─── UI helpers ─────────────────────────────────────────────────────
  Color get _statusColor {
    return switch (_status) {
      DetectionStatus.idle => const Color(0xFF718096),
      DetectionStatus.monitoring => const Color(0xFF4299E1),
      DetectionStatus.spikeDetected => const Color(0xFFED8936),
      DetectionStatus.reporting => const Color(0xFFECC94B),
      DetectionStatus.reported => const Color(0xFF38A169),
      DetectionStatus.error => const Color(0xFFE53E3E),
    };
  }

  String get _statusIcon {
    return switch (_status) {
      DetectionStatus.idle => '🛑',
      DetectionStatus.monitoring => '📡',
      DetectionStatus.spikeDetected => '⚡',
      DetectionStatus.reporting => '📤',
      DetectionStatus.reported => '✅',
      DetectionStatus.error => '❌',
    };
  }

  int get _severityLevel {
    if (_currentZValue > 18) return 5;
    if (_currentZValue > 14) return 3;
    if (_currentZValue > 9) return 2;
    return 1;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(),
              const SizedBox(height: 18),
              _buildTabSwitcher(),
              const SizedBox(height: 20),
              if (_selectedViewTab == 0) ...[
                // 🚗 Mode 0: Google Maps Navigation (Dematagoda -> Dehiwala Route)
                SizedBox(
                  height: 480,
                  child: InteractiveNavigationMap(
                    currentZSpike: _currentZValue,
                    isMonitoring: _isMonitoring,
                    onHazardDetected: (lat, lng, spike) {
                      setState(() {
                        _totalReports++;
                        _status = DetectionStatus.reported;
                      });
                      _showSnack('Road hazard auto-logged on route between Point A & Point B! ✅');
                    },
                  ),
                ),
                const SizedBox(height: 18),
                _buildStatsRow(),
                const SizedBox(height: 20),
                _buildControlButtons(),
                const SizedBox(height: 14),
                _buildManualReportButton(),
              ] else ...[
                // 📊 Mode 1: Detailed Sensor Gauges & AI Classification
                _buildStatusCard(),
                const SizedBox(height: 20),
                _buildZAxisGauge(),
                const SizedBox(height: 20),
                _buildGpsCard(),
                const SizedBox(height: 20),
                _buildPhotoSection(),
                const SizedBox(height: 20),
                _buildStatsRow(),
                const SizedBox(height: 24),
                _buildControlButtons(),
                const SizedBox(height: 14),
                _buildManualReportButton(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabSwitcher() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedViewTab = 0),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  gradient: _selectedViewTab == 0
                      ? const LinearGradient(colors: [Color(0xFF667EEA), Color(0xFF764BA2)])
                      : null,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.navigation_rounded,
                      size: 16,
                      color: _selectedViewTab == 0 ? Colors.white : const Color(0xFF718096),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Drive & Navigate',
                      style: GoogleFonts.outfit(
                        color: _selectedViewTab == 0 ? Colors.white : const Color(0xFF718096),
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedViewTab = 1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  gradient: _selectedViewTab == 1
                      ? const LinearGradient(colors: [Color(0xFF667EEA), Color(0xFF764BA2)])
                      : null,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.tune_rounded,
                      size: 16,
                      color: _selectedViewTab == 1 ? Colors.white : const Color(0xFF718096),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Sensor & AI HUD',
                      style: GoogleFonts.outfit(
                        color: _selectedViewTab == 1 ? Colors.white : const Color(0xFF718096),
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.warning_rounded, color: Colors.white, size: 26),
        ),
        const SizedBox(width: 14),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Road Hazard Detector',
              style: GoogleFonts.outfit(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              'SRMS — Smart City',
              style: GoogleFonts.outfit(
                color: const Color(0xFF718096),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatusCard() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _statusColor.withValues(alpha: 0.4), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: _statusColor.withValues(alpha: 0.15),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        children: [
          ScaleTransition(
            scale: _isMonitoring ? _pulseAnim : const AlwaysStoppedAnimation(1.0),
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: _statusColor.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(_statusIcon, style: const TextStyle(fontSize: 24)),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _status.name.toUpperCase(),
                  style: GoogleFonts.outfit(
                    color: _statusColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _statusMessage,
                  style: GoogleFonts.outfit(
                    color: const Color(0xFFE2E8F0),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildZAxisGauge() {
    final clampedZ = _currentZValue.clamp(0.0, 25.0);
    final fillRatio = clampedZ / 25.0;
    final Color gaugeColor = _currentZValue > _spikeThreshold
        ? const Color(0xFFE53E3E)
        : _currentZValue > 9
            ? const Color(0xFFED8936)
            : const Color(0xFF4299E1);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Accelerometer Z-Axis',
                style: GoogleFonts.outfit(
                  color: const Color(0xFF8B949E),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: gaugeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: gaugeColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  'Severity: $_severityLevel/5',
                  style: GoogleFonts.outfit(
                    color: gaugeColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _currentZValue.toStringAsFixed(2),
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontSize: 40,
                  fontWeight: FontWeight.w800,
                  height: 1.0,
                ),
              ),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  'm/s²',
                  style: GoogleFonts.outfit(
                    color: const Color(0xFF718096),
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Gauge bar
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: fillRatio,
              minHeight: 10,
              backgroundColor: const Color(0xFF21262D),
              valueColor: AlwaysStoppedAnimation<Color>(gaugeColor),
            ),
          ),
          const SizedBox(height: 8),
          // Threshold markers
          Row(
            children: [
              const Spacer(),
              _thresholdLabel('Score 3', 14.0 / 25.0),
              const SizedBox(width: 8),
              _thresholdLabel('Score 5', 18.0 / 25.0),
            ],
          ),
          if (_peakZSpike > 0) ...[
            const SizedBox(height: 10),
            Text(
              'Peak this session: ${_peakZSpike.toStringAsFixed(2)} m/s²',
              style: GoogleFonts.outfit(
                color: const Color(0xFF718096),
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _thresholdLabel(String label, double position) {
    return Text(
      '⚑ $label',
      style: GoogleFonts.outfit(color: const Color(0xFF718096), fontSize: 11),
    );
  }

  Widget _buildGpsCard() {
    final hasPosition = _lastPosition != null;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.location_on_rounded,
            color: hasPosition ? const Color(0xFF38A169) : const Color(0xFF718096),
            size: 28,
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'GPS Position',
                style: GoogleFonts.outfit(
                  color: const Color(0xFF8B949E),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                hasPosition
                    ? '${_lastPosition!.latitude.toStringAsFixed(5)}, ${_lastPosition!.longitude.toStringAsFixed(5)}'
                    : 'Not acquired yet',
                style: GoogleFonts.outfit(
                  color: hasPosition ? Colors.white : const Color(0xFF718096),
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (hasPosition)
                Text(
                  'Accuracy: ±${_lastPosition!.accuracy.toStringAsFixed(0)}m',
                  style: GoogleFonts.outfit(
                    color: const Color(0xFF718096),
                    fontSize: 11,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── 📸 Photo & AI badge section ────────────────────────────────────
  Widget _buildPhotoSection() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: _aiResult != null
              ? (_aiResult!.isAutoVerified
                  ? const Color(0xFF764BA2).withValues(alpha: 0.6)
                  : const Color(0xFF667EEA).withValues(alpha: 0.4))
              : const Color(0xFF30363D),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section title
          Row(
            children: [
              const Icon(Icons.camera_alt_rounded, color: Color(0xFF667EEA), size: 18),
              const SizedBox(width: 8),
              Text(
                'Hazard Photo',
                style: GoogleFonts.outfit(
                  color: const Color(0xFF8B949E),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              if (_isClassifying)
                const SizedBox(
                  width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF667EEA)),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Image preview or attach button
          if (_selectedImage != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(
                File(_selectedImage!.path),
                height: 140, width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(height: 10),
          ],

          // 🤖 AI Result Badge
          if (_aiResult != null) ...[
            AnimatedContainer(
              duration: const Duration(milliseconds: 400),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: _aiResult!.isAutoVerified
                      ? [const Color(0xFF667EEA).withValues(alpha: 0.2), const Color(0xFF764BA2).withValues(alpha: 0.15)]
                      : [const Color(0xFF2D3748), const Color(0xFF1A202C)],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _aiResult!.isAutoVerified
                      ? const Color(0xFF764BA2).withValues(alpha: 0.5)
                      : const Color(0xFF4A5568),
                ),
              ),
              child: Row(
                children: [
                  Text('🤖', style: const TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _aiResult!.isAutoVerified ? 'AI Verified ✅' : 'AI Analysed',
                          style: GoogleFonts.outfit(
                            color: _aiResult!.isAutoVerified
                                ? const Color(0xFFA78BFA)
                                : const Color(0xFF8B949E),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${_aiResult!.detectedCategory} — ${(_aiResult!.confidenceScore * 100).toStringAsFixed(0)}% confidence',
                          style: GoogleFonts.outfit(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                        if (_aiResult!.analysisSummary.isNotEmpty)
                          Text(
                            _aiResult!.analysisSummary,
                            style: GoogleFonts.outfit(color: const Color(0xFF8B949E), fontSize: 11),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Attach photo button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _showImagePickerDialog,
              icon: Icon(
                _selectedImage != null ? Icons.edit_outlined : Icons.add_a_photo_rounded,
                size: 18,
              ),
              label: Text(
                _selectedImage != null ? 'Change Photo' : '📸 Attach Hazard Photo',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF667EEA),
                side: const BorderSide(color: Color(0xFF667EEA), width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),

          if (_selectedImage != null && _aiResult == null && !_isClassifying) ...[
            const SizedBox(height: 8),
            Center(
              child: Text(
                'Photo will be AI-classified when you submit a report',
                style: GoogleFonts.outfit(color: const Color(0xFF4A5568), fontSize: 11),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatsRow() {
    return Row(
      children: [
        Expanded(child: _statCard('Reports Sent', _totalReports.toString(), Icons.send_rounded)),
        const SizedBox(width: 12),
        Expanded(
          child: _statCard(
            'Last ID',
            _lastReportId?.substring(0, min(8, _lastReportId?.length ?? 0)) ?? '—',
            Icons.tag_rounded,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _statCard(
            'Threshold',
            '${_spikeThreshold.toStringAsFixed(0)} m/s²',
            Icons.tune_rounded,
          ),
        ),
      ],
    );
  }

  Widget _statCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Column(
        children: [
          Icon(icon, color: const Color(0xFF667EEA), size: 18),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.outfit(color: const Color(0xFF718096), fontSize: 10),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildControlButtons() {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: _isMonitoring
            ? ElevatedButton.icon(
                key: const ValueKey('stop'),
                onPressed: _stopMonitoring,
                icon: const Icon(Icons.stop_circle_outlined),
                label: Text('Stop Monitoring', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 16)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2D3748),
                  foregroundColor: const Color(0xFFFC8181),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
              )
            : ElevatedButton.icon(
                key: const ValueKey('start'),
                onPressed: _status == DetectionStatus.reporting ? null : _startMonitoring,
                icon: const Icon(Icons.sensors_rounded),
                label: Text('Start Monitoring', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 16)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  padding: EdgeInsets.zero,
                ).copyWith(
                  backgroundColor: WidgetStateProperty.all(Colors.transparent),
                  shadowColor: WidgetStateProperty.all(Colors.transparent),
                ),
                clipBehavior: Clip.antiAlias,
              ).applyGradientBackground(
                const LinearGradient(colors: [Color(0xFF667EEA), Color(0xFF764BA2)]),
              ),
      ),
    );
  }

  Widget _buildManualReportButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton.icon(
        onPressed: _status == DetectionStatus.reporting ? null : _manualReport,
        icon: const Icon(Icons.report_gmailerrorred_rounded, size: 20),
        label: Text(
          'Manual Report (Force)',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFED8936),
          side: const BorderSide(color: Color(0xFFED8936), width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}

// Extension for gradient button background
extension on ElevatedButton {
  Widget applyGradientBackground(LinearGradient gradient) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: this,
    );
  }
}
