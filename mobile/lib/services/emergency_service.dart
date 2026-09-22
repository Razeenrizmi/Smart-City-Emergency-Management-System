import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/emergency_session.dart';
import '../models/green_wave_activation_response.dart';
import '../models/emergency_completion_response.dart';

class EmergencyService {
  final http.Client _client;
  final String baseUrl;

  EmergencyService({http.Client? client})
      : _client = client ?? http.Client(),
        baseUrl = ApiConfig.baseUrl;

  // Create emergency session
  Future<EmergencySession> createEmergencySession({
    required String driverId,
    required String vehicleType,
    String? selectedRouteId,
  }) async {
    try {
      final body = {
        'driverId': driverId,
        'vehicleType': vehicleType,
        if (selectedRouteId != null) 'selectedRouteId': selectedRouteId,
      };

      final response = await _client
          .post(
            Uri.parse('$baseUrl/emergencies'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode(body),
          )
          .timeout(ApiConfig.timeout);

      if (response.statusCode == 201) {
        final Map<String, dynamic> jsonData = json.decode(response.body) as Map<String, dynamic>;
        return EmergencySession.fromJson(jsonData);
      } else {
        throw Exception('Failed to create emergency session: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error creating emergency session: $e');
    }
  }

  // Get emergency session by ID
  Future<EmergencySession> getEmergencySessionById(String sessionId) async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/emergencies/$sessionId'))
          .timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final Map<String, dynamic> jsonData = json.decode(response.body) as Map<String, dynamic>;
        return EmergencySession.fromJson(jsonData);
      } else if (response.statusCode == 404) {
        throw Exception('Emergency session not found');
      } else {
        throw Exception('Failed to load emergency session: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error fetching emergency session: $e');
    }
  }

  // Activate Green Wave
  Future<GreenWaveActivationResponse> activateGreenWave(String sessionId) async {
    try {
      final response = await _client
          .post(
            Uri.parse('$baseUrl/emergencies/$sessionId/activate-green-wave'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final Map<String, dynamic> jsonData = json.decode(response.body) as Map<String, dynamic>;
        return GreenWaveActivationResponse.fromJson(jsonData);
      } else {
        throw Exception('Failed to activate Green Wave: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error activating Green Wave: $e');
    }
  }

  // Complete emergency session
  Future<EmergencyCompletionResponse> completeEmergencySession(String sessionId) async {
    try {
      final response = await _client
          .post(
            Uri.parse('$baseUrl/emergencies/$sessionId/complete'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final Map<String, dynamic> jsonData = json.decode(response.body) as Map<String, dynamic>;
        return EmergencyCompletionResponse.fromJson(jsonData);
      } else {
        throw Exception('Failed to complete emergency session: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error completing emergency session: $e');
    }
  }

  // Cancel emergency session
  Future<EmergencySession> cancelEmergencySession(String sessionId) async {
    try {
      final response = await _client
          .post(
            Uri.parse('$baseUrl/emergencies/$sessionId/cancel'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final Map<String, dynamic> jsonData = json.decode(response.body) as Map<String, dynamic>;
        return EmergencySession.fromJson(jsonData);
      } else {
        throw Exception('Failed to cancel emergency session: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error cancelling emergency session: $e');
    }
  }

  void dispose() {
    _client.close();
  }
}
