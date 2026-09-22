import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/hazard_report_model.dart';
import '../services/hazard_api_service.dart';
import '../services/navigation_launcher_service.dart';

class LatLngPoint {
  final double lat;
  final double lng;
  final String label;
  final String maneuver;

  const LatLngPoint({
    required this.lat,
    required this.lng,
    required this.label,
    this.maneuver = 'Continue straight',
  });
}

class ReportedMapHazard {
  final String id;
  final double lat;
  final double lng;
  final double zSpike;
  final int severity;
  final DateTime time;

  ReportedMapHazard({
    required this.id,
    required this.lat,
    required this.lng,
    required this.zSpike,
    required this.severity,
    required this.time,
  });
}

class InteractiveNavigationMap extends StatefulWidget {
  final double currentZSpike;
  final bool isMonitoring;
  final Function(double lat, double lng, double zSpike)? onHazardDetected;

  const InteractiveNavigationMap({
    super.key,
    required this.currentZSpike,
    required this.isMonitoring,
    this.onHazardDetected,
  });

  @override
  State<InteractiveNavigationMap> createState() => _InteractiveNavigationMapState();
}

class _InteractiveNavigationMapState extends State<InteractiveNavigationMap>
    with SingleTickerProviderStateMixin {
  // Colombo Corridor: Dematagoda -> Dehiwala Waypoints
  final List<LatLngPoint> _routePoints = const [
    LatLngPoint(lat: 6.9322, lng: 79.8821, label: 'Dematagoda Junction', maneuver: 'Start drive south on Baseline Rd (A001)'),
    LatLngPoint(lat: 6.9250, lng: 79.8805, label: 'Baseline Rd / Kolonnawa Rd', maneuver: 'In 900m, keep right towards Borella'),
    LatLngPoint(lat: 6.9147, lng: 79.8778, label: 'Borella Junction', maneuver: 'Continue south on Elvitigala Mawatha'),
    LatLngPoint(lat: 6.9075, lng: 79.8780, label: 'Castle Street Crossing', maneuver: 'Stay in left 2 lanes across flyover'),
    LatLngPoint(lat: 6.8988, lng: 79.8783, label: 'Narahenpita Junction', maneuver: 'Pass Kirimandala Mawatha towards Kirulapone'),
    LatLngPoint(lat: 6.8835, lng: 79.8762, label: 'Kirulapone / High Level Rd', maneuver: 'Turn right onto W.A. Silva Mawatha'),
    LatLngPoint(lat: 6.8745, lng: 79.8660, label: 'Pamankada Junction', maneuver: 'Continue towards Galle Road / Wellawatte'),
    LatLngPoint(lat: 6.8680, lng: 79.8610, label: 'Wellawatte / Galle Rd', maneuver: 'Merge onto Galle Road (A2) south towards Dehiwala'),
    LatLngPoint(lat: 6.8511, lng: 79.8653, label: 'Dehiwala Junction', maneuver: 'You have reached Dehiwala Junction! 🏁'),
  ];

  // Drive state
  int _currentWaypointIndex = 0;
  double _fractionToNext = 0.0;
  double _currentCarLat = 6.9322;
  double _currentCarLng = 79.8821;
  double _carBearing = 175.0; // degrees
  double _speedKmh = 0.0;
  bool _isDrivingSim = false;
  Timer? _driveTimer;

  // Hazards reported along this drive
  final List<ReportedMapHazard> _detectedHazards = [];

  // Map viewport & gestures
  double _zoom = 13.5;
  Offset _panOffset = Offset.zero;

  // Flash alert animation on spike
  bool _showSpikeFlash = false;
  String _lastAlertMsg = '';

  @override
  void initState() {
    super.initState();
    _currentCarLat = _routePoints.first.lat;
    _currentCarLng = _routePoints.first.lng;
  }

  @override
  void didUpdateWidget(covariant InteractiveNavigationMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If external accelerometer spiked above threshold (e.g. 11.5)
    if (widget.currentZSpike > 11.5 && oldWidget.currentZSpike <= 11.5) {
      _handleRoadHazardSpike(widget.currentZSpike);
    }
  }

  @override
  void dispose() {
    _driveTimer?.cancel();
    super.dispose();
  }

  // ─── Drive Simulation along Dematagoda -> Dehiwala ─────────────────
  void _toggleDriveSimulation() {
    setState(() {
      _isDrivingSim = !_isDrivingSim;
    });

    if (_isDrivingSim) {
      _driveTimer?.cancel();
      _driveTimer = Timer.periodic(const Duration(milliseconds: 250), (timer) {
        _advanceDriveStep();
      });
    } else {
      _driveTimer?.cancel();
      setState(() => _speedKmh = 0.0);
    }
  }

  void _advanceDriveStep() {
    if (_currentWaypointIndex >= _routePoints.length - 1) {
      // Loop back or stop
      setState(() {
        _currentWaypointIndex = 0;
        _fractionToNext = 0.0;
      });
      return;
    }

    final p1 = _routePoints[_currentWaypointIndex];
    final p2 = _routePoints[_currentWaypointIndex + 1];

    _fractionToNext += 0.04;
    if (_fractionToNext >= 1.0) {
      _currentWaypointIndex++;
      _fractionToNext = 0.0;
      if (_currentWaypointIndex >= _routePoints.length - 1) {
        _isDrivingSim = false;
        _driveTimer?.cancel();
        _speedKmh = 0.0;
        setState(() {});
        return;
      }
    }

    final newLat = p1.lat + (p2.lat - p1.lat) * _fractionToNext;
    final newLng = p1.lng + (p2.lng - p1.lng) * _fractionToNext;
    final bearing = _calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);

    setState(() {
      _currentCarLat = newLat;
      _currentCarLng = newLng;
      _carBearing = bearing;
      _speedKmh = 42.0 + (sin(_fractionToNext * 10) * 8.0);
    });
  }

  double _calculateBearing(double lat1, double lon1, double lat2, double lon2) {
    final dLon = (lon2 - lon1) * pi / 180;
    final y = sin(dLon) * cos(lat2 * pi / 180);
    final x = cos(lat1 * pi / 180) * sin(lat2 * pi / 180) -
        sin(lat1 * pi / 180) * cos(lat2 * pi / 180) * cos(dLon);
    final brng = atan2(y, x) * 180 / pi;
    return (brng + 360) % 360;
  }

  // ─── Trigger Pothole Detection along the road ──────────────────────
  Future<void> _handleRoadHazardSpike(double zSpike) async {
    final lat = _currentCarLat;
    final lng = _currentCarLng;
    final severity = zSpike >= 18 ? 5 : zSpike >= 14 ? 4 : zSpike >= 10 ? 3 : 2;

    setState(() {
      _showSpikeFlash = true;
      _lastAlertMsg = '💥 Pothole detected! Z = ${zSpike.toStringAsFixed(1)} m/s² (${_routePoints[_currentWaypointIndex].label})';
    });

    // Auto-report to backend
    final report = HazardReportModel(
      latitude: lat,
      longitude: lng,
      accelerometerZSpike: zSpike,
    );

    final res = await HazardApiService.postHazardReport(report);
    final reportId = res['success'] == true ? (res['data']?['id']?.toString() ?? 'SRMS-${Random().nextInt(9999)}') : 'LOCAL';

    final hazard = ReportedMapHazard(
      id: reportId,
      lat: lat,
      lng: lng,
      zSpike: zSpike,
      severity: severity,
      time: DateTime.now(),
    );

    setState(() {
      _detectedHazards.add(hazard);
    });

    widget.onHazardDetected?.call(lat, lng, zSpike);

    Future.delayed(const Duration(seconds: 4), () {
      if (mounted) setState(() => _showSpikeFlash = false);
    });
  }

  // ─── Launch native Google Maps navigation ──────────────────────────
  Future<void> _launchExternalGoogleMaps() async {
    final success = await NavigationLauncherService.openGoogleMapsNavigation(
      originLat: 6.9322,
      originLng: 79.8821,
      destLat: 6.8511,
      destLng: 79.8653,
      destinationName: 'Dehiwala, Colombo',
    );

    if (mounted && !success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not open external Google Maps. Check browser/maps app.', style: GoogleFonts.outfit()),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentInstruction = _routePoints[_currentWaypointIndex].maneuver;
    final currentArea = _routePoints[_currentWaypointIndex].label;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // 1. Google Maps Navigation Header HUD
          _buildNavigationHeader(currentInstruction, currentArea),

          // 2. Interactive Map Canvas with Dematagoda -> Dehiwala Route
          Expanded(
            child: Stack(
              children: [
                // Real Map Renderer with Polyline & Hazards
                GestureDetector(
                  onScaleUpdate: (details) {
                    setState(() {
                      _zoom = (_zoom * details.scale).clamp(11.0, 16.0);
                      _panOffset += details.focalPointDelta;
                    });
                  },
                  child: ClipRect(
                    child: CustomPaint(
                      painter: _ColomboRouteMapPainter(
                        routePoints: _routePoints,
                        carLat: _currentCarLat,
                        carLng: _currentCarLng,
                        carBearing: _carBearing,
                        hazards: _detectedHazards,
                        panOffset: _panOffset,
                        zoom: _zoom,
                      ),
                      child: Container(color: const Color(0xFF1A1D24)),
                    ),
                  ),
                ),

                // Live Spike Flash Alert Overlay
                if (_showSpikeFlash)
                  Positioned(
                    top: 12,
                    left: 12,
                    right: 12,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFE53E3E), Color(0xFFDD6B20)],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.red.withValues(alpha: 0.4),
                            blurRadius: 16,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 22),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _lastAlertMsg,
                              style: GoogleFonts.outfit(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Map HUD Controls (Recenter, Zoom, Google Maps Launch)
                Positioned(
                  top: 14,
                  right: 14,
                  child: Column(
                    children: [
                      _mapIconBtn(
                        icon: Icons.my_location_rounded,
                        tooltip: 'Recenter on Car',
                        onTap: () => setState(() => _panOffset = Offset.zero),
                      ),
                      const SizedBox(height: 8),
                      _mapIconBtn(
                        icon: Icons.add,
                        tooltip: 'Zoom in',
                        onTap: () => setState(() => _zoom = (_zoom + 0.5).clamp(11.0, 16.0)),
                      ),
                      const SizedBox(height: 8),
                      _mapIconBtn(
                        icon: Icons.remove,
                        tooltip: 'Zoom out',
                        onTap: () => setState(() => _zoom = (_zoom - 0.5).clamp(11.0, 16.0)),
                      ),
                    ],
                  ),
                ),

                // Google Maps External App Launch Pill
                Positioned(
                  bottom: 14,
                  left: 14,
                  child: ElevatedButton.icon(
                    onPressed: _launchExternalGoogleMaps,
                    icon: const Icon(Icons.directions_car_rounded, size: 18, color: Colors.white),
                    label: Text(
                      'Open Google Maps App',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 12),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1A73E8), // Google Blue
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 4,
                    ),
                  ),
                ),

                // Speedometer Badge
                Positioned(
                  bottom: 14,
                  right: 14,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D1117).withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF30363D)),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _speedKmh.toStringAsFixed(0),
                          style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'km/h',
                          style: GoogleFonts.outfit(color: const Color(0xFF8B949E), fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 3. Navigation Controls & Simulation Panel
          _buildBottomActionPanel(),
        ],
      ),
    );
  }

  // ─── Top Google Navigation Banner ──────────────────────────────────
  Widget _buildNavigationHeader(String instruction, String area) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Color(0xFF0F9D58), // Google Maps Navigation Green
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.turn_slight_left_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  instruction,
                  style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  area,
                  style: GoogleFonts.outfit(
                    color: Colors.white70,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.black26,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'Trip: 12.8 km',
              style: GoogleFonts.outfit(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Bottom Action Panel ───────────────────────────────────────────
  Widget _buildBottomActionPanel() {
    return Container(
      padding: const EdgeInsets.all(14),
      color: const Color(0xFF161B22),
      child: Column(
        children: [
          // Trip Stats Line
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: widget.isMonitoring ? const Color(0xFF38A169) : const Color(0xFF718096),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    widget.isMonitoring ? 'Sensor: Active' : 'Sensor: Idle',
                    style: GoogleFonts.outfit(
                      color: widget.isMonitoring ? const Color(0xFF38A169) : const Color(0xFF718096),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              Text(
                'Hazards Logged: ${_detectedHazards.length}',
                style: GoogleFonts.outfit(
                  color: const Color(0xFFED8936),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                'Lat: ${_currentCarLat.toStringAsFixed(4)}, Lng: ${_currentCarLng.toStringAsFixed(4)}',
                style: GoogleFonts.outfit(color: const Color(0xFF8B949E), fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Two Action Buttons: Drive Simulation + Simulate Road Spike
          Row(
            children: [
              // Cruise Drive Simulation
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _toggleDriveSimulation,
                  icon: Icon(_isDrivingSim ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 18),
                  label: Text(
                    _isDrivingSim ? 'Pause Drive' : 'Drive Route',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isDrivingSim ? const Color(0xFF2D3748) : const Color(0xFF667EEA),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Trigger Simulated Bump / Pothole
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    // Simulate random realistic bump between 13.0 and 19.5 m/s²
                    final spike = 13.0 + Random().nextDouble() * 6.5;
                    _handleRoadHazardSpike(spike);
                  },
                  icon: const Icon(Icons.flash_on_rounded, size: 18, color: Color(0xFFED8936)),
                  label: Text(
                    'Simulate Spike',
                    style: GoogleFonts.outfit(
                      color: const Color(0xFFED8936),
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFED8936), width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _mapIconBtn({required IconData icon, required String tooltip, required VoidCallback onTap}) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: const Color(0xFF161B22).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: IconButton(
        padding: EdgeInsets.zero,
        icon: Icon(icon, size: 20, color: Colors.white),
        tooltip: tooltip,
        onPressed: onTap,
      ),
    );
  }
}

// ─── Custom Painter for Colombo Dematagoda -> Dehiwala Route ─────────
class _ColomboRouteMapPainter extends CustomPainter {
  final List<LatLngPoint> routePoints;
  final double carLat;
  final double carLng;
  final double carBearing;
  final List<ReportedMapHazard> hazards;
  final Offset panOffset;
  final double zoom;

  // Bounding box reference (Colombo Dematagoda to Dehiwala)
  static const double minLat = 6.8400;
  static const double maxLat = 6.9450;
  static const double minLng = 79.8500;
  static const double maxLng = 79.8950;

  _ColomboRouteMapPainter({
    required this.routePoints,
    required this.carLat,
    required this.carLng,
    required this.carBearing,
    required this.hazards,
    required this.panOffset,
    required this.zoom,
  });

  Offset _latLngToScreen(double lat, double lng, Size size) {
    final scale = (zoom / 13.5);
    final normX = (lng - minLng) / (maxLng - minLng);
    final normY = 1.0 - ((lat - minLat) / (maxLat - minLat)); // inverted Y for screen

    final cx = size.width / 2;
    final cy = size.height / 2;

    final x = cx + (normX * size.width - cx) * scale + panOffset.dx;
    final y = cy + (normY * size.height - cy) * scale + panOffset.dy;

    return Offset(x, y);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFF12161F);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    // 1. Draw Grid Lines / Arterials
    final gridPaint = Paint()
      ..color = const Color(0xFF1E2532)
      ..strokeWidth = 1.0;
    for (double x = 0; x < size.width; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += 40) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 2. Draw Secondary Roads (Marine Drive & Galle Rd network)
    final secondaryRoadPaint = Paint()
      ..color = const Color(0xFF263042)
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round;

    final galleRd1 = _latLngToScreen(6.9350, 79.8550, size);
    final galleRd2 = _latLngToScreen(6.8450, 79.8650, size);
    canvas.drawLine(galleRd1, galleRd2, secondaryRoadPaint);

    // 3. Draw Route Polyline (Dematagoda -> Dehiwala Corridor)
    final polyPath = Path();
    for (int i = 0; i < routePoints.length; i++) {
      final pt = _latLngToScreen(routePoints[i].lat, routePoints[i].lng, size);
      if (i == 0) {
        polyPath.moveTo(pt.dx, pt.dy);
      } else {
        polyPath.lineTo(pt.dx, pt.dy);
      }
    }

    // Glow under polyline
    final glowPaint = Paint()
      ..color = const Color(0xFF4285F4).withValues(alpha: 0.3)
      ..strokeWidth = 12.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(polyPath, glowPaint);

    // Google Navigation Blue Route
    final routePaint = Paint()
      ..color = const Color(0xFF1A73E8)
      ..strokeWidth = 6.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(polyPath, routePaint);

    // 4. Draw Waypoint Nodes & Labels
    for (int i = 0; i < routePoints.length; i++) {
      final pt = _latLngToScreen(routePoints[i].lat, routePoints[i].lng, size);
      final isStart = i == 0;
      final isEnd = i == routePoints.length - 1;

      if (isStart || isEnd) {
        // Start (Green) & End (Red) pins
        final pinColor = isStart ? const Color(0xFF0F9D58) : const Color(0xFFEA4335);
        final pinPaint = Paint()..color = pinColor;
        canvas.drawCircle(pt, 7.0, pinPaint);
        canvas.drawCircle(pt, 12.0, pinPaint..style = PaintingStyle.stroke..strokeWidth = 2.0);

        final tp = TextPainter(
          text: TextSpan(
            text: isStart ? '🚩 Dematagoda' : '🏁 Dehiwala',
            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(pt.dx + 12, pt.dy - 6));
      } else {
        // Minor waypoint dot
        final nodePaint = Paint()..color = const Color(0xFF8AB4F8);
        canvas.drawCircle(pt, 3.0, nodePaint);
      }
    }

    // 5. Draw Reported Hazards (Potholes along the route)
    for (final h in hazards) {
      final hPt = _latLngToScreen(h.lat, h.lng, size);

      // Outer alert pulse
      final alertPulse = Paint()
        ..color = const Color(0xFFE53E3E).withValues(alpha: 0.4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.0;
      canvas.drawCircle(hPt, 14.0, alertPulse);

      // Warning marker center
      final hazardCenter = Paint()..color = const Color(0xFFE53E3E);
      canvas.drawCircle(hPt, 7.0, hazardCenter);

      // Warning label
      final hazardText = TextPainter(
        text: TextSpan(
          text: '💥 Z:${h.zSpike.toStringAsFixed(1)}',
          style: const TextStyle(color: Color(0xFFFEB2B2), fontSize: 9, fontWeight: FontWeight.bold),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      hazardText.paint(canvas, Offset(hPt.dx - 16, hPt.dy - 22));
    }

    // 6. Draw Moving Car / Vehicle Marker
    final carPt = _latLngToScreen(carLat, carLng, size);

    // Car GPS Aura
    final carAura = Paint()
      ..color = const Color(0xFF4285F4).withValues(alpha: 0.25)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(carPt, 22.0, carAura);

    // Car Icon with Bearing Rotation
    canvas.save();
    canvas.translate(carPt.dx, carPt.dy);
    canvas.rotate((carBearing * pi) / 180);

    // Car body chevron
    final carBody = Path()
      ..moveTo(0, -14)
      ..lineTo(9, 10)
      ..lineTo(0, 5)
      ..lineTo(-9, 10)
      ..close();

    final carPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawPath(carBody, carPaint);

    final carStroke = Paint()
      ..color = const Color(0xFF1A73E8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawPath(carBody, carStroke);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _ColomboRouteMapPainter oldDelegate) {
    return oldDelegate.carLat != carLat ||
        oldDelegate.carLng != carLng ||
        oldDelegate.carBearing != carBearing ||
        oldDelegate.hazards.length != hazards.length ||
        oldDelegate.panOffset != panOffset ||
        oldDelegate.zoom != zoom;
  }
}
