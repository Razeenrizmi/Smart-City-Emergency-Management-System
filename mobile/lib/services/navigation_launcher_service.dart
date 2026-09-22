import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class NavigationLauncherService {
  static const MethodChannel _channel = MethodChannel('com.srms.mobile/navigation');

  /// Launch Google Maps navigation for a route from Dematagoda to Dehiwala (or custom coords)
  static Future<bool> openGoogleMapsNavigation({
    double originLat = 6.9322,
    double originLng = 79.8821,
    double destLat = 6.8511,
    double destLng = 79.8653,
    String destinationName = 'Dehiwala, Colombo',
  }) async {
    String url;
    if (kIsWeb) {
      url = 'https://www.google.com/maps/dir/?api=1&origin=$originLat,$originLng&destination=$destLat,$destLng&travelmode=driving';
    } else if (Platform.isAndroid) {
      // Direct Google Maps turn-by-turn navigation intent
      url = 'google.navigation:q=$destLat,$destLng&mode=d';
    } else if (Platform.isIOS) {
      url = 'comgooglemaps://?saddr=$originLat,$originLng&daddr=$destLat,$destLng&directionsmode=driving';
    } else {
      url = 'https://www.google.com/maps/dir/?api=1&origin=$originLat,$originLng&destination=$destLat,$destLng&travelmode=driving';
    }

    try {
      final res = await _channel.invokeMethod<bool>('openMap', {'url': url});
      if (res == true) return true;
    } catch (_) {
      // Fallback to web URL if native intent fails
      try {
        final webUrl = 'https://www.google.com/maps/dir/?api=1&origin=$originLat,$originLng&destination=$destLat,$destLng&travelmode=driving';
        final fallbackRes = await _channel.invokeMethod<bool>('openMap', {'url': webUrl});
        return fallbackRes == true;
      } catch (_) {}
    }
    return false;
  }
}
