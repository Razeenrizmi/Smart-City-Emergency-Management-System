import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/route.dart';

class RouteService {
  final http.Client _client;
  final String baseUrl;

  RouteService({http.Client? client})
      : _client = client ?? http.Client(),
        baseUrl = ApiConfig.baseUrl;

  // Get all routes
  Future<List<Route>> getAllRoutes() async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/routes'))
          .timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final List<dynamic> jsonData = json.decode(response.body) as List<dynamic>;
        return jsonData.map((json) => Route.fromJson(json as Map<String, dynamic>)).toList();
      } else {
        throw Exception('Failed to load routes: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error fetching routes: $e');
    }
  }

  // Get route by ID
  Future<Route> getRouteById(String routeId) async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/routes/$routeId'))
          .timeout(ApiConfig.timeout);

      if (response.statusCode == 200) {
        final Map<String, dynamic> jsonData = json.decode(response.body) as Map<String, dynamic>;
        return Route.fromJson(jsonData);
      } else if (response.statusCode == 404) {
        throw Exception('Route not found');
      } else {
        throw Exception('Failed to load route: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error fetching route: $e');
    }
  }

  void dispose() {
    _client.close();
  }
}
