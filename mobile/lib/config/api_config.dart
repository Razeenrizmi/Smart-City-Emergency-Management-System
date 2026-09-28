class ApiConfig {
  // Base URL for the API
  // For local development, use localhost. Change this for production deployment.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5017/api',
  );

  // Timeout duration for API requests
  static const Duration timeout = Duration(seconds: 30);
}
