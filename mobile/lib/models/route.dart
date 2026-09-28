import 'route_junction.dart';

class Route {
  final String routeId;
  final String routeName;
  final String startLocation;
  final String destination;
  final double distanceKm;
  final int estimatedTimeMinutes;
  final String trafficLevel;
  final List<RouteJunction> junctions;

  Route({
    required this.routeId,
    required this.routeName,
    required this.startLocation,
    required this.destination,
    required this.distanceKm,
    required this.estimatedTimeMinutes,
    required this.trafficLevel,
    required this.junctions,
  });

  factory Route.fromJson(Map<String, dynamic> json) {
    final junctionsList = json['junctions'] as List<dynamic>? ?? [];
    final junctions = junctionsList
        .map((junctionJson) => RouteJunction.fromJson(junctionJson as Map<String, dynamic>))
        .toList();

    return Route(
      routeId: json['routeId'] as String,
      routeName: json['routeName'] as String,
      startLocation: json['startLocation'] as String,
      destination: json['destination'] as String,
      distanceKm: (json['distanceKm'] as num).toDouble(),
      estimatedTimeMinutes: json['estimatedTimeMinutes'] as int,
      trafficLevel: json['trafficLevel'] as String,
      junctions: junctions,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'routeId': routeId,
      'routeName': routeName,
      'startLocation': startLocation,
      'destination': destination,
      'distanceKm': distanceKm,
      'estimatedTimeMinutes': estimatedTimeMinutes,
      'trafficLevel': trafficLevel,
      'junctions': junctions.map((j) => j.toJson()).toList(),
    };
  }
}
