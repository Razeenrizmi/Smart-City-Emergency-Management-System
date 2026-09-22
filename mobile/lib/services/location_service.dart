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

    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );
  }
}
