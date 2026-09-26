import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Service for calling SRMS AI backend endpoints.
class AiApiService {
  static String get _baseUrl {
    if (kIsWeb) return 'http://localhost:5017';
    if (Platform.isAndroid) return 'http://10.0.2.2:5017';
    return 'http://localhost:5017';
  }

  // ─── POST /api/ai/classify-image ─────────────────────────────────────────
  /// Sends a base64-encoded image to the AI vision classifier.
  /// Returns { success, detectedCategory, confidenceScore, isAutoVerified, analysisSummary }
  static Future<Map<String, dynamic>> classifyImage({
    required String imageBase64,
    String? hazardReportId,
    double accelerometerSpike = 0.0,
  }) async {
    try {
      final body = <String, dynamic>{
        'imageBase64': imageBase64,
        'accelerometerSpike': accelerometerSpike,
      };
      if (hazardReportId != null) body['hazardReportId'] = hazardReportId;

      final response = await http
          .post(
            Uri.parse('$_baseUrl/api/ai/classify-image'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return {'success': true, 'data': decoded['data']};
      } else {
        return {
          'success': false,
          'error': 'AI service error: HTTP ${response.statusCode}',
        };
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  // ─── GET /api/ai/insights ─────────────────────────────────────────────────
  /// Fetches city-wide AI insights: RDI, clusters, advisories.
  static Future<Map<String, dynamic>> getInsights() async {
    try {
      final response = await http
          .get(Uri.parse('$_baseUrl/api/ai/insights'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return {'success': true, 'data': decoded['data']};
      } else {
        return {'success': false, 'error': 'HTTP ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  // ─── POST /api/ai/chat ────────────────────────────────────────────────────
  /// Sends a natural-language prompt to the AI Copilot chat.
  static Future<Map<String, dynamic>> chat(String prompt) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/api/ai/chat'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'prompt': prompt}),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return {'success': true, 'data': decoded['data']};
      } else {
        return {'success': false, 'error': 'HTTP ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
}

/// Data class representing an AI classification result on the mobile side.
class AiClassificationResult {
  final String detectedCategory;
  final double confidenceScore;
  final bool isAutoVerified;
  final String analysisSummary;

  const AiClassificationResult({
    required this.detectedCategory,
    required this.confidenceScore,
    required this.isAutoVerified,
    required this.analysisSummary,
  });

  factory AiClassificationResult.fromJson(Map<String, dynamic> json) =>
      AiClassificationResult(
        detectedCategory: json['detectedCategory'] ?? 'UNKNOWN',
        confidenceScore: (json['confidenceScore'] ?? 0.0).toDouble(),
        isAutoVerified: json['isAutoVerified'] ?? false,
        analysisSummary: json['analysisSummary'] ?? '',
      );

  /// Badge label shown to the user, e.g. "🤖 AI Verified: Pothole (94%)"
  String get badgeText =>
      '🤖 ${isAutoVerified ? 'AI Verified' : 'AI Analysed'}: '
      '$detectedCategory (${(confidenceScore * 100).toStringAsFixed(0)}%)';
}
