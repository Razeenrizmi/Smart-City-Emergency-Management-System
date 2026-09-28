class ActivatedJunctionInfo {
  final String junctionId;
  final String junctionName;
  final int sequenceNumber;
  final String signalState;

  ActivatedJunctionInfo({
    required this.junctionId,
    required this.junctionName,
    required this.sequenceNumber,
    required this.signalState,
  });

  factory ActivatedJunctionInfo.fromJson(Map<String, dynamic> json) {
    return ActivatedJunctionInfo(
      junctionId: json['junctionId'] as String,
      junctionName: json['junctionName'] as String,
      sequenceNumber: json['sequenceNumber'] as int,
      signalState: json['signalState'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'junctionId': junctionId,
      'junctionName': junctionName,
      'sequenceNumber': sequenceNumber,
      'signalState': signalState,
    };
  }
}

class GreenWaveActivationResponse {
  final String sessionId;
  final String? routeId;
  final String routeName;
  final String status;
  final List<ActivatedJunctionInfo> junctions;

  GreenWaveActivationResponse({
    required this.sessionId,
    this.routeId,
    required this.routeName,
    required this.status,
    required this.junctions,
  });

  factory GreenWaveActivationResponse.fromJson(Map<String, dynamic> json) {
    final junctionsList = json['junctions'] as List<dynamic>? ?? [];
    final junctions = junctionsList
        .map((junctionJson) => ActivatedJunctionInfo.fromJson(junctionJson as Map<String, dynamic>))
        .toList();

    return GreenWaveActivationResponse(
      sessionId: json['sessionId'] as String,
      routeId: json['routeId'] as String?,
      routeName: json['routeName'] as String,
      status: json['status'] as String,
      junctions: junctions,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'routeId': routeId,
      'routeName': routeName,
      'status': status,
      'junctions': junctions.map((j) => j.toJson()).toList(),
    };
  }
}
