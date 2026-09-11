import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/scan_result.dart';

class ApiService {
  static const String baseUrl = 'http://10.0.2.2:5017/api';
  // For Android emulator use 10.0.2.2, for iOS use localhost
  // For real device, use your PC's IP address

  static Future<ScanResult?> scanVehicleImage(File imageFile) async {
    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/crime-vehicle/scan'),
      );
      request.files.add(
        await http.MultipartFile.fromPath('image', imageFile.path),
      );

      var streamedResponse = await request.send().timeout(
        const Duration(seconds: 30),
      );
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        if (body['success'] == true && body['data'] != null) {
          return ScanResult.fromJson(body['data']);
        }
      }
      return null;
    } catch (e) {
      print('Scan error: $e');
      return null;
    }
  }

  static Future<List<Map<String, dynamic>>> getCameras() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/crime-vehicle/cameras'),
      );
      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        return List<Map<String, dynamic>>.from(body['data'] ?? []);
      }
      return [];
    } catch (e) {
      print('Get cameras error: $e');
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> getHotlist() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/crime-vehicle/hotlist'),
      );
      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        return List<Map<String, dynamic>>.from(body['data'] ?? []);
      }
      return [];
    } catch (e) {
      print('Get hotlist error: $e');
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> getDetectionLogs() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/crime-vehicle/logs'),
      );
      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        return List<Map<String, dynamic>>.from(body['data'] ?? []);
      }
      return [];
    } catch (e) {
      print('Get logs error: $e');
      return [];
    }
  }
}
