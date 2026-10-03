import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/hazard_report_model.dart';

class HazardApiService {
  static String? _workingBaseUrl;

  static List<String> get _candidateBaseUrls {
    if (kIsWeb) return const ['http://localhost:5017'];
    if (Platform.isAndroid) {
      return const [
        'http://127.0.0.1:5017', // Works via adb reverse (Mac host)
        'http://10.0.2.2:5017',  // Standard Android emulator gateway
        'http://localhost:5017',
      ];
    }
    return const ['http://localhost:5017', 'http://127.0.0.1:5017'];
  }

  static Future<Map<String, dynamic>> postHazardReport(
    HazardReportModel report,
  ) async {
    final urlsToTry = _workingBaseUrl != null
        ? [_workingBaseUrl!, ..._candidateBaseUrls.where((u) => u != _workingBaseUrl)]
        : _candidateBaseUrls;

    String? lastError;

    for (final base in urlsToTry) {
      try {
        final response = await http
            .post(
              Uri.parse('$base/api/hazards/report'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode(report.toJson()),
            )
            .timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) {
          _workingBaseUrl = base; // Cache the responsive endpoint
          return {'success': true, 'data': jsonDecode(response.body)};
        } else {
          lastError = 'Server responded with status ${response.statusCode}';
        }
      } catch (e) {
        lastError = e.toString();
        // Continue to next candidate URL
      }
    }

    return {'success': false, 'error': lastError ?? 'Unable to connect to server'};
  }
}
