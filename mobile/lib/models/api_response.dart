/// Envelope used by every ASP.NET endpoint:
/// `{ "success": bool, "message": string, "data": T }`
class ApiResponse<T> {
  final bool success;
  final String message;
  final T? data;

  const ApiResponse({
    required this.success,
    required this.message,
    this.data,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Object? raw)? decode,
  ) {
    return ApiResponse(
      success: json['success'] == true,
      message: (json['message'] as String?) ?? '',
      data: decode == null ? null : decode(json['data']),
    );
  }
}

/// Thrown when the monitoring server is unreachable or returns an error.
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final bool isNetwork;

  const ApiException(this.message, {this.statusCode, this.isNetwork = false});

  @override
  String toString() => message;
}
