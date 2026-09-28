class RestoredJunctionInfo {
  final String junctionId;
  final String junctionName;
  final String restoredSignalState;

  RestoredJunctionInfo({
    required this.junctionId,
    required this.junctionName,
    required this.restoredSignalState,
  });

  factory RestoredJunctionInfo.fromJson(Map<String, dynamic> json) {
    return RestoredJunctionInfo(
      junctionId: json['junctionId'] as String,
      junctionName: json['junctionName'] as String,
      restoredSignalState: json['restoredSignalState'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'junctionId': junctionId,
      'junctionName': junctionName,
      'restoredSignalState': restoredSignalState,
    };
  }
}

class EmergencyCompletionResponse {
  final String sessionId;
  final String status;
  final bool greenWaveRestored;
  final List<RestoredJunctionInfo> restoredJunctions;

  EmergencyCompletionResponse({
    required this.sessionId,
    required this.status,
    required this.greenWaveRestored,
    required this.restoredJunctions,
  });

  factory EmergencyCompletionResponse.fromJson(Map<String, dynamic> json) {
    final restoredJunctionsList = json['restoredJunctions'] as List<dynamic>? ?? [];
    final restoredJunctions = restoredJunctionsList
        .map((junctionJson) => RestoredJunctionInfo.fromJson(junctionJson as Map<String, dynamic>))
        .toList();

    return EmergencyCompletionResponse(
      sessionId: json['sessionId'] as String,
      status: json['status'] as String,
      greenWaveRestored: json['greenWaveRestored'] as bool,
      restoredJunctions: restoredJunctions,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'status': status,
      'greenWaveRestored': greenWaveRestored,
      'restoredJunctions': restoredJunctions.map((j) => j.toJson()).toList(),
    };
  }
}
