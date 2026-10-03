import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

class LocationService {
  /// Requests permissions if needed and returns the current position.
  /// Throws an exception if permissions are denied or location is unavailable.
  ///
  /// IMPORTANT: Does NOT fall back to `getLastKnownPosition()` — that often
  /// returns a stale, cached fix (especially on emulators), which is the usual
  /// cause of reports landing at the wrong spot.
  static Future<Position> getCurrentPosition() async {
    await _ensurePermission();

    final settings = _highAccuracySettings(timeLimit: const Duration(seconds: 30));

    return await Geolocator.getCurrentPosition(locationSettings: settings);
  }

  /// Returns a continuous stream of GPS positions at high accuracy.
  /// Use this during active monitoring so every hazard report uses the
  /// freshest location, not a one-shot fix that might be stale.
  static Stream<Position> positionStream() {
    _ensurePermission(); // fire-and-forget; the stream itself will also fail if denied

    final settings = _highAccuracySettings(
      timeLimit: null,
      distanceFilter: 5, // emit a new position every ~5 meters of movement
    );

    return Geolocator.getPositionStream(locationSettings: settings);
  }

  // ─── Internals ─────────────────────────────────────────────────────

  /// Shared permission check.
  static Future<void> _ensurePermission() async {
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
  }

  /// Build platform-appropriate high-accuracy settings.
  ///
  /// On Android we explicitly use the platform LocationManager (GPS provider)
  /// instead of the fused provider, which can return a stale cached fix —
  /// the usual reason an emulator keeps reporting its default location.
  static LocationSettings _highAccuracySettings({
    Duration? timeLimit,
    int distanceFilter = 0,
  }) {
    if (!kIsWeb && Platform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.best,
        forceLocationManager: true, // bypass fused-provider stale cache
        timeLimit: timeLimit,
        distanceFilter: distanceFilter,
      );
    }

    return LocationSettings(
      accuracy: LocationAccuracy.best,
      timeLimit: timeLimit ?? const Duration(seconds: 30),
      distanceFilter: distanceFilter,
    );
  }
}
