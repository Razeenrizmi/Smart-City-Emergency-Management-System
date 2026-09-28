class RouteJunction {
  final String junctionId;
  final String junctionName;
  final double latitude;
  final double longitude;
  final String currentSignalState;
  final int sequenceNumber;

  RouteJunction({
    required this.junctionId,
    required this.junctionName,
    required this.latitude,
    required this.longitude,
    required this.currentSignalState,
    required this.sequenceNumber,
  });

  factory RouteJunction.fromJson(Map<String, dynamic> json) {
    return RouteJunction(
      junctionId: json['junctionId'] as String,
      junctionName: json['junctionName'] as String,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      currentSignalState: json['currentSignalState'] as String,
      sequenceNumber: json['sequenceNumber'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'junctionId': junctionId,
      'junctionName': junctionName,
      'latitude': latitude,
      'longitude': longitude,
      'currentSignalState': currentSignalState,
      'sequenceNumber': sequenceNumber,
    };
  }
}
