class EmergencySession {
  final String sessionId;
  final String driverId;
  final String vehicleType;
  final String status;
  final String? selectedRouteId;
  final DateTime createdAt;
  final DateTime updatedAt;

  EmergencySession({
    required this.sessionId,
    required this.driverId,
    required this.vehicleType,
    required this.status,
    this.selectedRouteId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory EmergencySession.fromJson(Map<String, dynamic> json) {
    return EmergencySession(
      sessionId: json['sessionId'] as String,
      driverId: json['driverId'] as String,
      vehicleType: json['vehicleType'] as String,
      status: json['status'] as String,
      selectedRouteId: json['selectedRouteId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'driverId': driverId,
      'vehicleType': vehicleType,
      'status': status,
      'selectedRouteId': selectedRouteId,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
