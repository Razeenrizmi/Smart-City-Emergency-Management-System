import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/hazard_report_model.dart';
import '../services/hazard_api_service.dart';
import '../services/navigation_launcher_service.dart';
import '../services/location_service.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

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

class TripPreset {
  final String title;
  final String originName;
  final double originLat;
  final double originLng;
  final String destName;
  final double destLat;
  final double destLng;

  const TripPreset({
    required this.title,
    required this.originName,
    required this.originLat,
    required this.originLng,
    required this.destName,
    required this.destLat,
    required this.destLng,
  });
}

const List<TripPreset> defaultTripPresets = [
  TripPreset(
    title: 'Colombo Fort ➔ Bambalapitiya',
    originName: 'Colombo Fort (Point A)',
    originLat: 6.9344,
    originLng: 79.8428,
    destName: 'Bambalapitiya (Point B)',
    destLat: 6.8920,
    destLng: 79.8550,
  ),
  TripPreset(
    title: 'Dematagoda ➔ Dehiwala',
    originName: 'Dematagoda Junction (Point A)',
    originLat: 6.9322,
    originLng: 79.8821,
    destName: 'Dehiwala Junction (Point B)',
    destLat: 6.8511,
    destLng: 79.8653,
  ),
  TripPreset(
    title: 'Pettah ➔ Mount Lavinia',
    originName: 'Pettah Central (Point A)',
    originLat: 6.9366,
    originLng: 79.8500,
    destName: 'Mount Lavinia (Point B)',
    destLat: 6.8350,
    destLng: 79.8640,
  ),
  TripPreset(
    title: 'Borella ➔ Battaramulla',
    originName: 'Borella Cross (Point A)',
    originLat: 6.9147,
    originLng: 79.8778,
    destName: 'Battaramulla (Point B)',
    destLat: 6.8980,
    destLng: 79.9190,
  ),
];

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
  // Current dynamic endpoints
  String _originName = 'Colombo Fort (Point A)';
  double _originLat = 6.9344;
  double _originLng = 79.8428;

  String _destName = 'Bambalapitiya (Point B)';
  double _destLat = 6.8920;
  double _destLng = 79.8550;

  // Dynamically generated route points
  List<LatLngPoint> _routePoints = [];

  // Drive state
  int _currentWaypointIndex = 0;
  double _fractionToNext = 0.0;
  double _currentCarLat = 6.9344;
  double _currentCarLng = 79.8428;
  double _carBearing = 175.0; // degrees
  double _speedKmh = 0.0;
  bool _isDrivingSim = false;
  Timer? _driveTimer;

  // Hazards reported along this dynamic trip
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
    _buildDynamicRoute(
      startLat: _originLat,
      startLng: _originLng,
      startLabel: _originName,
      endLat: _destLat,
      endLng: _destLng,
      endLabel: _destName,
    );
  }

  /// Dynamically computes realistic intermediate waypoints between Point A and Point B
  void _buildDynamicRoute({
    required double startLat,
    required double startLng,
    required String startLabel,
    required double endLat,
    required double endLng,
    required String endLabel,
  }) {
    const int stepCount = 8;
    final List<LatLngPoint> points = [];

    // Start Point A
    points.add(LatLngPoint(
      lat: startLat,
      lng: startLng,
      label: startLabel,
      maneuver: 'Start trip from $startLabel',
    ));

    // Intermediate Waypoints with slight realistic curvature
    final dLat = (endLat - startLat) / stepCount;
    final dLng = (endLng - startLng) / stepCount;

    for (int i = 1; i < stepCount; i++) {
      // Add subtle curved deviation to mimic road geometry
      final progress = i / stepCount;
      final curveOffset = sin(progress * pi) * 0.0035;

      final wLat = startLat + dLat * i + curveOffset;
      final wLng = startLng + dLng * i - (curveOffset * 0.5);

      final distanceM = (progress * _calculateDistanceKm(startLat, startLng, endLat, endLng) * 1000).toInt();

      points.add(LatLngPoint(
        lat: wLat,
        lng: wLng,
        label: 'Waypoint $i (${distanceM}m along route)',
        maneuver: i == 1
            ? 'Continue on main arterial route'
            : i == stepCount - 1
                ? 'Approaching destination in 400m'
                : 'Follow Google Maps route towards $endLabel',
      ));
    }

    // Destination Point B
    points.add(LatLngPoint(
      lat: endLat,
      lng: endLng,
      label: endLabel,
      maneuver: 'You have arrived at $endLabel! 🏁',
    ));

    setState(() {
      _originLat = startLat;
      _originLng = startLng;
      _originName = startLabel;
      _destLat = endLat;
      _destLng = endLng;
      _destName = endLabel;
      _routePoints = points;
      _currentWaypointIndex = 0;
      _fractionToNext = 0.0;
      _currentCarLat = startLat;
      _currentCarLng = startLng;
      _panOffset = Offset.zero;
      _zoom = 13.5;
      _carBearing = _calculateBearing(startLat, startLng, endLat, endLng);
    });
  }

  double _calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const p = 0.017453292519943295; // Math.PI / 180
    final a = 0.5 - cos((lat2 - lat1) * p) / 2 +
        cos(lat1 * p) * cos(lat2 * p) * (1 - cos((lon2 - lon1) * p)) / 2;
    return 12742 * asin(sqrt(a)); // 2 * R * asin...
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

  // ─── Drive Simulation along Dynamic Route ──────────────────────────
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
    if (_routePoints.isEmpty) return;
    if (_currentWaypointIndex >= _routePoints.length - 1) {
      // Reached destination, pause or loop
      setState(() {
        _isDrivingSim = false;
        _speedKmh = 0.0;
      });
      _driveTimer?.cancel();
      return;
    }

    final p1 = _routePoints[_currentWaypointIndex];
    final p2 = _routePoints[_currentWaypointIndex + 1];

    _fractionToNext += 0.05;
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

  // ─── Trigger Pothole Detection along dynamic trip ──────────────────
  Future<void> _handleRoadHazardSpike(double zSpike) async {
    final lat = _currentCarLat;
    final lng = _currentCarLng;
    final severity = zSpike >= 18 ? 5 : zSpike >= 14 ? 4 : zSpike >= 10 ? 3 : 2;

    setState(() {
      _showSpikeFlash = true;
      _lastAlertMsg = '💥 Pothole detected on route between Point A & Point B! Z = ${zSpike.toStringAsFixed(1)} m/s²';
    });

    // Auto-report to backend
    final report = HazardReportModel(
      latitude: lat,
      longitude: lng,
      accelerometerZSpike: zSpike,
      hazardType: 'POTHOLE',
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

  // ─── Launch native Google Maps navigation with Dynamic Origin & Destination ──
  Future<void> _launchExternalGoogleMaps() async {
    final success = await NavigationLauncherService.openGoogleMapsNavigation(
      originLat: _originLat,
      originLng: _originLng,
      destLat: _destLat,
      destLng: _destLng,
      destinationName: _destName,
    );

    if (mounted && !success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not open external Google Maps. Check browser or Maps app.', style: GoogleFonts.outfit()),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  // ─── Open Dynamic Route Selector Modal ────────────────────────────
  void _openRouteSelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Select Dynamic Trip (Point A ➔ Point B)',
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Option: Use Current GPS for Point A
                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: const Color(0xFF0F9D58).withValues(alpha: 0.15),
                    leading: const Icon(Icons.my_location_rounded, color: Color(0xFF0F9D58)),
                    title: Text(
                      'Use My Current GPS as Point A',
                      style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    subtitle: Text(
                      'Detects real location and navigates to $_destName',
                      style: GoogleFonts.outfit(color: const Color(0xFF8B949E), fontSize: 12),
                    ),
                    onTap: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      Navigator.pop(ctx);
                      try {
                        final pos = await LocationService.getCurrentPosition();
                        _buildDynamicRoute(
                          startLat: pos.latitude,
                          startLng: pos.longitude,
                          startLabel: 'My Current Location (Point A)',
                          endLat: _destLat,
                          endLng: _destLng,
                          endLabel: _destName,
                        );
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text('Origin updated to current GPS! 📍', style: GoogleFonts.outfit()),
                            backgroundColor: const Color(0xFF0F9D58),
                          ),
                        );
                      } catch (e) {
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text('Could not get GPS: $e', style: GoogleFonts.outfit()),
                            backgroundColor: Colors.redAccent,
                          ),
                        );
                      }
                    },
                  ),
                  const SizedBox(height: 12),

                  Text(
                    'Preset Routes in Sri Lanka:',
                    style: GoogleFonts.outfit(color: const Color(0xFF8B949E), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),

                  ...defaultTripPresets.map((preset) {
                    final isSelected = _originName == preset.originName && _destName == preset.destName;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF1A73E8).withValues(alpha: 0.18) : const Color(0xFF0D1117),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF1A73E8) : const Color(0xFF30363D),
                        ),
                      ),
                      child: ListTile(
                        leading: Icon(
                          Icons.route_rounded,
                          color: isSelected ? const Color(0xFF1A73E8) : const Color(0xFF8B949E),
                        ),
                        title: Text(
                          preset.title,
                          style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        subtitle: Text(
                          '${preset.originName} ➔ ${preset.destName}',
                          style: GoogleFonts.outfit(color: const Color(0xFF8B949E), fontSize: 11),
                        ),
                        trailing: isSelected ? const Icon(Icons.check_circle, color: Color(0xFF1A73E8), size: 20) : null,
                        onTap: () {
                          Navigator.pop(ctx);
                          _buildDynamicRoute(
                            startLat: preset.originLat,
                            startLng: preset.originLng,
                            startLabel: preset.originName,
                            endLat: preset.destLat,
                            endLng: preset.destLng,
                            endLabel: preset.destName,
                          );
                        },
                      ),
                    );
                  }),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentInstruction = _routePoints.isNotEmpty && _currentWaypointIndex < _routePoints.length
        ? _routePoints[_currentWaypointIndex].maneuver
        : 'Driving straight on route';
    final currentArea = _routePoints.isNotEmpty && _currentWaypointIndex < _routePoints.length
        ? _routePoints[_currentWaypointIndex].label
        : 'Route Active';

    final totalKm = _calculateDistanceKm(_originLat, _originLng, _destLat, _destLng);
    final etaMins = (totalKm / 35.0 * 60).round().clamp(5, 120);

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
          _buildNavigationHeader(currentInstruction, currentArea, totalKm, etaMins),

          // Dynamic Trip Selector Bar
          _buildRouteEndpointsBar(),

          // 2. Interactive Map Canvas with Dynamic Route
          Expanded(
            child: Stack(
              children: [
                // Real Map Renderer with Polyline & Hazards
                FlutterMap(
                options: MapOptions(
                  initialCenter: LatLng(_currentCarLat, _currentCarLng),
                  initialZoom: _zoom,
                  minZoom: 10,
                  maxZoom: 18,
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.example.mobile',
                  ),

                  // Route
                  PolylineLayer(
                    polylines: [                      
                      Polyline(
                        points: _routePoints
                            .map((p) => LatLng(p.lat, p.lng))
                            .toList(),
                        strokeWidth: 6,
                        color: const Color(0xFF1A73E8),
                      ),
                    ],
                  ),

                  // Markers
                  MarkerLayer(
                    markers: [
                      // Point A
                      Marker(
                        point: LatLng(_originLat, _originLng),
                        width: 50,
                        height: 50,
                        child: const Icon(
                          Icons.location_on,
                          color: Color(0xFF0F9D58),
                          size: 40,
                        ),
                      ),

                      // Point B
                      Marker(
                        point: LatLng(_destLat, _destLng),
                        width: 50,
                        height: 50,
                        child: const Icon(
                          Icons.location_on,
                          color: Color(0xFFEA4335),
                          size: 40,
                        ),
                      ),

                      // Moving car
                      Marker(
                        point: LatLng(_currentCarLat, _currentCarLng),
                        width: 60,
                        height: 60,
                        child: Transform.rotate(
                          angle: _carBearing * pi / 180,
                          child: const Icon(
                            Icons.navigation,
                            color: Color(0xFF1A73E8),
                            size: 40,
                          ),
                        ),
                      ),

                      // Hazards
                      ..._detectedHazards.map(
                        (h) => Marker(
                          point: LatLng(h.lat, h.lng),
                          width: 50,
                          height: 50,
                          child: const Icon(
                            Icons.warning_rounded,
                            color: Colors.red,
                            size: 36,
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Required OpenStreetMap attribution
                  const SimpleAttributionWidget(
                    source: Text('OpenStreetMap contributors'),
                  ),
                ],
              )
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

                // Map HUD Controls (Recenter, Zoom, Dynamic Route Selector)
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
  Widget _buildNavigationHeader(String instruction, String area, double totalKm, int etaMins) {
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
            child: const Icon(Icons.navigation_rounded, color: Colors.white, size: 24),
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
                    fontSize: 13,
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${totalKm.toStringAsFixed(1)} km',
                  style: GoogleFonts.outfit(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                ),
                Text(
                  '$etaMins min',
                  style: GoogleFonts.outfit(color: Colors.white70, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Dynamic Endpoints Selector Bar ────────────────────────────────
  Widget _buildRouteEndpointsBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      color: const Color(0xFF0D1117),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.fiber_manual_record, color: Color(0xFF0F9D58), size: 12),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _originName,
                        style: GoogleFonts.outfit(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.location_on, color: Color(0xFFEA4335), size: 12),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _destName,
                        style: GoogleFonts.outfit(color: const Color(0xFFC9D1D9), fontSize: 11),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: _openRouteSelector,
            icon: const Icon(Icons.swap_horiz_rounded, size: 16, color: Color(0xFF63B3ED)),
            label: Text(
              'Change Trip',
              style: GoogleFonts.outfit(color: const Color(0xFF63B3ED), fontSize: 11, fontWeight: FontWeight.w700),
            ),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              backgroundColor: const Color(0xFF161B22),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
                    _isDrivingSim ? 'Pause Drive' : 'Start Trip Drive',
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

// ─── Custom Dynamic Route Painter for Any Point A to Point B ─────────
class _DynamicRouteMapPainter extends CustomPainter {
  final List<LatLngPoint> routePoints;
  final double carLat;
  final double carLng;
  final double carBearing;
  final List<ReportedMapHazard> hazards;
  final Offset panOffset;
  final double zoom;

  _DynamicRouteMapPainter({
    required this.routePoints,
    required this.carLat,
    required this.carLng,
    required this.carBearing,
    required this.hazards,
    required this.panOffset,
    required this.zoom,
  });

  Offset _latLngToScreen(double lat, double lng, Size size) {
    if (routePoints.isEmpty) {
      return Offset(size.width / 2, size.height / 2);
    }

    // Dynamically calculate bounding box with safety margins
    double minLat = routePoints.first.lat;
    double maxLat = routePoints.first.lat;
    double minLng = routePoints.first.lng;
    double maxLng = routePoints.first.lng;

    for (final p in routePoints) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    // Add 25% padding around bounds
    final latPadding = max((maxLat - minLat) * 0.25, 0.008);
    final lngPadding = max((maxLng - minLng) * 0.25, 0.008);

    minLat -= latPadding;
    maxLat += latPadding;
    minLng -= lngPadding;
    maxLng += lngPadding;

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

    // 1. Draw Grid Lines
    final gridPaint = Paint()
      ..color = const Color(0xFF1E2532)
      ..strokeWidth = 1.0;
    for (double x = 0; x < size.width; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += 40) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    if (routePoints.isEmpty) return;

    // 2. Draw Dynamic Route Polyline
    final polyPath = Path();
    for (int i = 0; i < routePoints.length; i++) {
      final pt = _latLngToScreen(routePoints[i].lat, routePoints[i].lng, size);
      if (i == 0) {
        polyPath.moveTo(pt.dx, pt.dy);
      } else {
        polyPath.lineTo(pt.dx, pt.dy);
      }
    }

    // Outer Glow under polyline
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

    // 3. Draw Waypoint Nodes & Start/End Badges
    for (int i = 0; i < routePoints.length; i++) {
      final pt = _latLngToScreen(routePoints[i].lat, routePoints[i].lng, size);
      final isStart = i == 0;
      final isEnd = i == routePoints.length - 1;

      if (isStart || isEnd) {
        // Point A (Green) & Point B (Red) pins
        final pinColor = isStart ? const Color(0xFF0F9D58) : const Color(0xFFEA4335);
        final pinPaint = Paint()..color = pinColor;
        canvas.drawCircle(pt, 7.0, pinPaint);
        canvas.drawCircle(pt, 12.0, pinPaint..style = PaintingStyle.stroke..strokeWidth = 2.0);

        final labelText = isStart ? '🚩 Point A' : '🏁 Point B';
        final tp = TextPainter(
          text: TextSpan(
            text: labelText,
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

    // 4. Draw Reported Hazards (Potholes along the dynamic route)
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

    // 5. Draw Moving Vehicle Marker
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
  bool shouldRepaint(covariant _DynamicRouteMapPainter oldDelegate) {
    return oldDelegate.carLat != carLat ||
        oldDelegate.carLng != carLng ||
        oldDelegate.carBearing != carBearing ||
        oldDelegate.hazards.length != hazards.length ||
        oldDelegate.panOffset != panOffset ||
        oldDelegate.zoom != zoom ||
        oldDelegate.routePoints != routePoints;
  }
}
