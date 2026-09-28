import 'dart:async';
import 'dart:io';

import 'package:geolocator/geolocator.dart';

class LocationService {
  /// Requests permissions if needed and returns the current position.
  /// Throws an exception if permissions are denied or location is unavailable.
  static Future<Position> getCurrentPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Location services are disabled. Please enable them in Settings.');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Location permissions are denied.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception(
        'Location permissions are permanently denied. Please enable them in Settings.',
      );
    }

    // Force a fresh, high-accuracy fix. On Android we explicitly use the
    // platform LocationManager (GPS provider) instead of the fused provider,
    // which can return a stale cached fix — the usual reason an emulator keeps
    // reporting its default location instead of the one you set.
    const timeout = Duration(seconds: 30);
    final LocationSettings settings = Platform.isAndroid
        ? AndroidSettings(
            accuracy: LocationAccuracy.best,
            forceLocationManager: true,
            timeLimit: timeout,
          )
        : const LocationSettings(
            accuracy: LocationAccuracy.best,
            timeLimit: timeout,
          );

    try {
      return await Geolocator.getCurrentPosition(locationSettings: settings);
    } on TimeoutException {
      // A fresh fix didn't arrive in time; fall back to the most recent known
      // position instead of failing the whole hazard report.
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) return lastKnown;
      rethrow;
    }
  }
}
