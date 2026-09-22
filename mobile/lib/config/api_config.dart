class ApiConfig {
  // Base URL for the API
  // For local development, use localhost. Change this for production deployment.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:5000/api',
  );

  // Timeout duration for API requests
  static const Duration timeout = Duration(seconds: 30);
}
