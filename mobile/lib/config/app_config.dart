/// Runtime configuration for the monitoring client.
///
/// Override the backend URL without hard-coding localhost for a physical phone:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5017/api
///
/// Defaults:
///   Android emulator → 10.0.2.2 (host loopback)
///   iOS simulator     → localhost
class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5017/api',
  );

  /// Google Maps API Key
  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: 'AIzaSyAFpWqcupJaexQqMYN_i1AMNz8RW7rSslg',
  );

  /// Dashboard / list refresh interval (backend has no WebSocket — poll gently).
  static const Duration pollInterval = Duration(seconds: 5);

  /// Page size for alert / detection history.
  static const int historyPageSize = 20;

  static const Duration httpTimeout = Duration(seconds: 12);

  /// Frame scan timeout — YOLO + OCR can take longer than a normal API call.
  static const Duration scanTimeout = Duration(seconds: 30);

  /// Default AI sample rate when `GET /api/detection/config` is unreachable
  /// (mirrors the backend `Detection` section: 5 FPS → 200 ms).
  static const int fallbackFrameIntervalMs = 200;
  static const int fallbackTargetAiFps = 5;

  static const String appName = 'Crime Vehicle Detection';
}
