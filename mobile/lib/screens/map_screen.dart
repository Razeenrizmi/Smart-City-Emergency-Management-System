import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config/app_config.dart';
import '../models/cctv_node.dart';
import '../services/cctv_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'cctv_detail_screen.dart';

/// Real Camera & Mobile Device Location Google Map Screen.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  Timer? _timer;
  List<CctvNode> _nodes = [];
  bool _loading = true;
  String? _error;

  // Real Mobile Device GPS Position
  LatLng? _deviceLocation;
  double? _deviceAccuracy;
  bool _locatingGps = false;
  String? _gpsError;

  final MapController _mapController = MapController();
  bool _fitted = false;

  static const _fallbackCenter = LatLng(6.9271, 79.8612);

  @override
  void initState() {
    super.initState();
    _initDataAndGps();
    _timer = Timer.periodic(AppConfig.pollInterval, (_) => _loadNodes(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _initDataAndGps() async {
    await Future.wait([
      _loadNodes(),
      _getDeviceRealGps(),
    ]);
  }

  Future<void> _getDeviceRealGps({bool showSnack = false}) async {
    if (_locatingGps) return;
    setState(() {
      _locatingGps = true;
      _gpsError = null;
    });

    try {
      // Check & request location permission
      var status = await Permission.location.status;
      if (status.isDenied || status.isRestricted) {
        status = await Permission.location.request();
      }

      if (status.isPermanentlyDenied) {
        setState(() {
          _gpsError = 'Location permission permanently denied. Enable in system settings.';
          _locatingGps = false;
        });
        if (showSnack && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Location permission denied in settings'),
              backgroundColor: AppPalette.error,
            ),
          );
        }
        return;
      }

      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _gpsError = 'GPS Location Service is disabled on device.';
          _locatingGps = false;
        });
        if (showSnack && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please enable GPS Location Service on device'),
              backgroundColor: AppPalette.warning,
            ),
          );
        }
        return;
      }

      // Fetch high accuracy real device position
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      final newLoc = LatLng(position.latitude, position.longitude);

      if (!mounted) return;
      setState(() {
        _deviceLocation = newLoc;
        _deviceAccuracy = position.accuracy;
        _gpsError = null;
        _locatingGps = false;
      });

      // Animate map camera to real GPS location
      _mapController.move(newLoc, 16);

      if (showSnack && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Real GPS location detected: ${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}'),
            backgroundColor: AppPalette.success,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _gpsError = 'GPS error: ${e.toString()}';
        _locatingGps = false;
      });
    }
  }

  List<CctvNode> _locatedNodes(List<CctvNode> nodes) => nodes
      .where((n) => n.lat != null && n.lng != null)
      .toList(growable: false);

  void _fitToAllCameras() {
    final located = _locatedNodes(_nodes);
    final allPoints = <LatLng>[];

    if (_deviceLocation != null) {
      allPoints.add(_deviceLocation!);
    }
    for (final n in located) {
      allPoints.add(LatLng(n.lat!, n.lng!));
    }

    if (allPoints.isEmpty) return;

    if (allPoints.length == 1) {
      _mapController.move(allPoints.first, 16);
      return;
    }

    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: LatLngBounds.fromPoints(allPoints),
        padding: const EdgeInsets.all(60),
      ),
    );
  }

  Future<void> _loadNodes({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final nodes = await CctvService.instance.getNodes();
      if (!mounted) return;
      setState(() {
        _nodes = nodes;
        _error = null;
        _loading = false;
      });

      if (!_fitted) {
        _fitted = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fitToAllCameras();
        });
      }
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('REAL CAMERA MAP'),
        actions: [
          IconButton(
            onPressed: () => _getDeviceRealGps(showSnack: true),
            icon: Icon(
              Icons.my_location,
              color: _locatingGps ? AppPalette.accent : Colors.white,
            ),
            tooltip: 'Detect Real Device GPS',
          ),
          IconButton(
            onPressed: () => _initDataAndGps(),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Map & Nodes',
          ),
        ],
      ),
      body: _body(),
    );
  }

  Widget _body() {
    if (_loading && _nodes.isEmpty && _error == null) {
      return const LoadingView(message: 'Detecting real camera GPS coordinates...');
    }
    if (_error != null && _nodes.isEmpty) {
      return ErrorView(message: _error!, onRetry: () => _initDataAndGps());
    }

    final located = _locatedNodes(_nodes);
    final onlineCount = _nodes.where((n) => n.isOnline).length;

    final initialCenter = _deviceLocation ??
        (located.isNotEmpty
            ? LatLng(located.first.lat!, located.first.lng!)
            : _fallbackCenter);

    final googleApiKey = AppConfig.googleMapsApiKey;
    final googleTileUrl =
        'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${googleApiKey.isNotEmpty ? '&key=$googleApiKey' : ''}';

    return Column(
      children: [
        // Real GPS Banner Status
        if (_gpsError != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            color: AppPalette.error.withValues(alpha: 0.2),
            child: Row(
              children: [
                const Icon(Icons.warning_amber, size: 14, color: AppPalette.error),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _gpsError!,
                    style: const TextStyle(color: AppPalette.error, fontSize: 11),
                  ),
                ),
                TextButton(
                  onPressed: () => _getDeviceRealGps(showSnack: true),
                  child: const Text('RETRY GPS', style: TextStyle(fontSize: 10, color: AppPalette.accent)),
                ),
              ],
            ),
          )
        else if (_deviceLocation != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            color: AppPalette.surface2,
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppPalette.success,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'REAL MOBILE GPS: ${_deviceLocation!.latitude.toStringAsFixed(4)}, ${_deviceLocation!.longitude.toStringAsFixed(4)}',
                  style: const TextStyle(
                    color: AppPalette.success,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'monospace',
                  ),
                ),
                if (_deviceAccuracy != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    '(±${_deviceAccuracy!.toStringAsFixed(0)}m)',
                    style: const TextStyle(color: AppPalette.textMuted, fontSize: 10),
                  ),
                ],
                const Spacer(),
                InkWell(
                  onTap: () => _mapController.move(_deviceLocation!, 16),
                  child: const Row(
                    children: [
                      Icon(Icons.center_focus_strong, size: 13, color: AppPalette.accent),
                      SizedBox(width: 4),
                      Text('FOCUS', style: TextStyle(color: AppPalette.accent, fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
          ),

        // Interactive Map
        Expanded(
          child: Stack(
            children: [
              FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: initialCenter,
                  initialZoom: 15,
                ),
                children: [
                  TileLayer(
                    urlTemplate: googleTileUrl,
                    subdomains: const ['mt0', 'mt1', 'mt2', 'mt3'],
                    userAgentPackageName: 'com.example.mobile',
                  ),
                  MarkerLayer(
                    markers: [
                      // 1. Real Mobile Device Camera Marker
                      if (_deviceLocation != null)
                        Marker(
                          point: _deviceLocation!,
                          width: 110,
                          height: 70,
                          child: GestureDetector(
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    'Mobile Camera Real GPS: ${_deviceLocation!.latitude.toStringAsFixed(6)}, ${_deviceLocation!.longitude.toStringAsFixed(6)}',
                                  ),
                                  backgroundColor: AppPalette.surface2,
                                ),
                              );
                            },
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: AppPalette.success,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppPalette.success.withValues(alpha: 0.6),
                                        blurRadius: 10,
                                        spreadRadius: 2,
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.camera_alt,
                                    size: 18,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.85),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: AppPalette.success),
                                  ),
                                  child: const Text(
                                    'MOBILE CAMERA (GPS)',
                                    style: TextStyle(
                                      color: AppPalette.success,
                                      fontSize: 8,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                      // 2. Backend CCTV Nodes Markers
                      for (final n in located)
                        Marker(
                          point: LatLng(n.lat!, n.lng!),
                          width: 100,
                          height: 60,
                          child: GestureDetector(
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => CctvDetailScreen(nodeId: n.nodeId),
                              ),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  n.isOnline ? Icons.videocam : Icons.videocam_off,
                                  size: 28,
                                  color: n.isOnline ? AppPalette.online : AppPalette.offline,
                                  shadows: [
                                    Shadow(
                                      color: Colors.black.withValues(alpha: 0.8),
                                      blurRadius: 6,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.8),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                      color: (n.isOnline ? AppPalette.online : AppPalette.offline)
                                          .withValues(alpha: 0.7),
                                    ),
                                  ),
                                  child: Text(
                                    n.nodeLabel,
                                    style: TextStyle(
                                      color: n.isOnline ? AppPalette.online : AppPalette.text,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  const RichAttributionWidget(
                    attributions: [
                      TextSourceAttribution('Google Maps'),
                    ],
                  ),
                ],
              ),

              // Map Control Buttons Overlay
              Positioned(
                top: 12,
                right: 12,
                child: Column(
                  children: [
                    FloatingActionButton.small(
                      heroTag: 'recenter_all',
                      backgroundColor: AppPalette.surface,
                      onPressed: () => _fitToAllCameras(),
                      tooltip: 'Fit All Cameras',
                      child: const Icon(Icons.aspect_ratio, color: Colors.white),
                    ),
                    const SizedBox(height: 8),
                    FloatingActionButton.small(
                      heroTag: 'my_gps',
                      backgroundColor: AppPalette.surface,
                      onPressed: () => _getDeviceRealGps(showSnack: true),
                      tooltip: 'Locate My Real GPS',
                      child: Icon(
                        Icons.my_location,
                        color: _deviceLocation != null ? AppPalette.success : AppPalette.accent,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Bottom Cameras Horizontal Carousel
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          color: AppPalette.surface,
          child: Row(
            children: [
              const Icon(Icons.location_on, size: 14, color: AppPalette.accent),
              const SizedBox(width: 6),
              Text(
                '${located.length + (_deviceLocation != null ? 1 : 0)} REAL CAMERAS ON GOOGLE MAP',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              StatusChip.online(label: '${onlineCount + (_deviceLocation != null ? 1 : 0)} ON'),
            ],
          ),
        ),

        SizedBox(
          height: 110,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(10),
            children: [
              // Mobile Camera Card
              if (_deviceLocation != null)
                GestureDetector(
                  onTap: () => _mapController.move(_deviceLocation!, 16),
                  child: Container(
                    width: 230,
                    margin: const EdgeInsets.only(right: 10),
                    child: Card(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: AppPalette.success, width: 1.5),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.camera_alt, size: 16, color: AppPalette.success),
                                const SizedBox(width: 6),
                                const Expanded(
                                  child: Text(
                                    'Mobile Live Camera',
                                    style: TextStyle(
                                      color: AppPalette.success,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                                StatusChip.online(label: 'LIVE'),
                              ],
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Real Mobile Device GPS Location',
                              style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                            const Spacer(),
                            Text(
                              'Lat ${_deviceLocation!.latitude.toStringAsFixed(4)} · Lng ${_deviceLocation!.longitude.toStringAsFixed(4)}',
                              style: const TextStyle(color: AppPalette.textMuted, fontSize: 10, fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

              // CCTV Nodes Cards
              for (final n in _nodes)
                GestureDetector(
                  onTap: () {
                    if (n.lat != null && n.lng != null) {
                      _mapController.move(LatLng(n.lat!, n.lng!), 16);
                    }
                  },
                  child: Container(
                    width: 230,
                    margin: const EdgeInsets.only(right: 10),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    n.nodeLabel,
                                    style: const TextStyle(
                                      color: AppPalette.accent,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                                n.isOnline
                                    ? StatusChip.online(label: 'ON')
                                    : StatusChip.offline(label: 'OFF'),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              n.location.isEmpty ? n.cameraName : n.location,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              n.lat == null
                                  ? 'No coordinates'
                                  : 'Lat ${n.lat!.toStringAsFixed(4)} · Lng ${n.lng!.toStringAsFixed(4)}',
                              style: const TextStyle(
                                color: AppPalette.textMuted,
                                fontSize: 10,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
