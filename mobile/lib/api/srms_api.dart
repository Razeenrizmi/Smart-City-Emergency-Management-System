import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/camera_status.dart';
import '../models/intersection_summary.dart';

// Thin wrapper around the shared SRMS.API backend — the same base URL and
// endpoint the React web app calls, unwraps the ApiResponse<T>
// { success, message, data } shape every SRMS.API endpoint returns.
class SrmsApi {
  static const String baseUrl = 'http://localhost:5017';

  Future<List<IntersectionSummary>> getIntersections() async {
    final res = await http.get(Uri.parse('$baseUrl/api/intersections'));
    final body = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode != 200 || body['success'] != true) {
      throw Exception(body['message'] as String? ?? 'Request failed (${res.statusCode})');
    }

    final data = body['data'] as List<dynamic>;
    return data
        .map((e) => IntersectionSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<CameraStatus>> getCameras(String intersectionId) async {
    final res = await http.get(Uri.parse('$baseUrl/api/intersections/$intersectionId/cameras'));
    final body = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode != 200 || body['success'] != true) {
      throw Exception(body['message'] as String? ?? 'Request failed (${res.statusCode})');
    }

    final data = body['data'] as List<dynamic>;
    return data
        .map((e) => CameraStatus.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> reportCameraFault(String cameraSensorId, String description) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/cameras/$cameraSensorId/fault-reports'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'description': description}),
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode != 200 || body['success'] != true) {
      throw Exception(body['message'] as String? ?? 'Request failed (${res.statusCode})');
    }
  }
}
