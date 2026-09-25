import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/api_response.dart';

/// Thin HTTP client for the existing ASP.NET backend.
/// No authentication headers — the university backend exposes open endpoints.
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  final http.Client _client = http.Client();

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$p').replace(queryParameters: query);
  }

  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, String>? query,
    required T Function(Object? data) decode,
  }) async {
    try {
      final res = await _client
          .get(_uri(path, query))
          .timeout(AppConfig.httpTimeout);
      return _wrap(res, decode);
    } on TimeoutException {
      throw const ApiException(
        'Request timed out. The monitoring server may be busy.',
        isNetwork: true,
      );
    } on http.ClientException {
      throw const ApiException(
        'Unable to connect to the monitoring server.\nPlease check the network connection.',
        isNetwork: true,
      );
    } on FormatException {
      throw const ApiException('Invalid response from the server.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        'Unable to connect to the monitoring server.\nPlease check the network connection.',
        isNetwork: true,
      );
    }
  }

  Future<ApiResponse<T>> postForm<T>(
    String path, {
    Map<String, String> fields = const {},
    required T Function(Object? data) decode,
  }) async {
    try {
      final res = await _client
          .post(_uri(path), body: fields)
          .timeout(AppConfig.httpTimeout);
      return _wrap(res, decode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw const ApiException(
        'Unable to connect to the monitoring server.',
        isNetwork: true,
      );
    }
  }

  /// JSON POST — `body` may be null for endpoints with no payload
  /// (e.g. `POST /api/cctv/nodes/{id}/start`).
  Future<ApiResponse<T>> postJson<T>(
    String path, {
    Object? body,
    required T Function(Object? data) decode,
  }) async {
    try {
      final res = await _client
          .post(
            _uri(path),
            headers: const {'Content-Type': 'application/json'},
            body: body == null ? null : json.encode(body),
          )
          .timeout(AppConfig.httpTimeout);
      return _wrap(res, decode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw const ApiException(
        'Unable to connect to the monitoring server.',
        isNetwork: true,
      );
    }
  }

  /// JSON PUT (e.g. `PUT /api/cctv/nodes/{id}/status` with `{ "status": ... }`).
  Future<ApiResponse<T>> putJson<T>(
    String path, {
    Object? body,
    required T Function(Object? data) decode,
  }) async {
    try {
      final res = await _client
          .put(
            _uri(path),
            headers: const {'Content-Type': 'application/json'},
            body: body == null ? null : json.encode(body),
          )
          .timeout(AppConfig.httpTimeout);
      return _wrap(res, decode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw const ApiException(
        'Unable to connect to the monitoring server.',
        isNetwork: true,
      );
    }
  }

  /// JSON DELETE (e.g. `DELETE /api/crime-vehicle/hotlist/{id}`).
  Future<ApiResponse<T>> deleteJson<T>(
    String path, {
    required T Function(Object? data) decode,
  }) async {
    try {
      final res = await _client
          .delete(_uri(path))
          .timeout(AppConfig.httpTimeout);
      return _wrap(res, decode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw const ApiException(
        'Unable to connect to the monitoring server.',
        isNetwork: true,
      );
    }
  }

  /// Multipart POST (camera frames) — same encoding the web client uses
  /// for `POST /api/crime-vehicle/scan`.
  Future<ApiResponse<T>> postMultipart<T>(
    String path, {
    Map<String, String> fields = const {},
    List<http.MultipartFile> files = const [],
    Duration? timeout,
    required T Function(Object? data) decode,
  }) async {
    try {
      final request = http.MultipartRequest('POST', _uri(path))
        ..fields.addAll(fields)
        ..files.addAll(files);
      final res = await _client
          .send(request)
          .timeout(timeout ?? AppConfig.scanTimeout)
          .then(http.Response.fromStream);
      return _wrap(res, decode);
    } on TimeoutException {
      throw const ApiException(
        'Scan request timed out. The AI service may be busy.',
        isNetwork: true,
      );
    } on http.ClientException {
      throw const ApiException(
        'Unable to connect to the monitoring server.',
        isNetwork: true,
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw const ApiException(
        'Unable to reach the monitoring server.',
        isNetwork: true,
      );
    }
  }

  ApiResponse<T> _wrap<T>(
    http.Response res,
    T Function(Object? data) decode,
  ) {
    if (res.statusCode >= 500) {
      throw ApiException(
        'Server error (${res.statusCode}). Please try again.',
        statusCode: res.statusCode,
      );
    }
    if (res.body.isEmpty) {
      throw const ApiException('Empty response from the server.');
    }
    final body = json.decode(res.body);
    if (body is! Map<String, dynamic>) {
      throw const ApiException('Invalid response from the server.');
    }
    final api = ApiResponse.fromJson(body, decode);
    if (!api.success && res.statusCode >= 400) {
      throw ApiException(
        api.message.isEmpty ? 'Request failed (${res.statusCode})' : api.message,
        statusCode: res.statusCode,
      );
    }
    return api;
  }

  List<T> decodeList<T>(Object? raw, T Function(Map<String, dynamic>) item) {
    if (raw is! List) return <T>[];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(item)
        .toList(growable: false);
  }

  void dispose() {
    _client.close();
  }
}
