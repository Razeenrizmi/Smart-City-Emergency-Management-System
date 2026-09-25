/// `GET /api/detection/history` or `GET /api/crime-vehicle/logs` → `DetectionLog`
/// (also doubles as the alert record when Status == REQUIRES_OFFICER_REVIEW).
class DetectionLog {
  final int id;
  final String logId;
  final String timestamp;
  final String plateNumber;
  final String cameraId;
  final String cameraName;
  final String location;
  final double confidence;
  final bool isHotlistMatch;
  final String threatLevel;
  final String vehicleDetails;
  final String status;
  final String snapshot;
  final int nodeId;
  final String sessionId;
  final int? trackId;
  final String vehicleType;
  final double vehicleConfidence;
  final double ocrConfidence;
  final bool crimeMatch;

  const DetectionLog({
    required this.id,
    required this.logId,
    required this.timestamp,
    required this.plateNumber,
    required this.cameraId,
    required this.cameraName,
    required this.location,
    required this.confidence,
    required this.isHotlistMatch,
    required this.threatLevel,
    required this.vehicleDetails,
    required this.status,
    required this.snapshot,
    required this.nodeId,
    required this.sessionId,
    required this.trackId,
    required this.vehicleType,
    required this.vehicleConfidence,
    required this.ocrConfidence,
    required this.crimeMatch,
  });

  bool get isActiveAlert => status == 'REQUIRES_OFFICER_REVIEW';

  bool get isCrimeVehicle => crimeMatch || isHotlistMatch;

  String get nodeLabel {
    if (nodeId <= 0) return cameraId.isEmpty ? 'WEB' : cameraId;
    return 'NODE-${nodeId.toString().padLeft(3, '0')}';
  }

  String get timePart {
    if (timestamp.length >= 19) return timestamp.substring(11, 19);
    return timestamp;
  }

  String get datePart {
    if (timestamp.length >= 10) return timestamp.substring(0, 10);
    return timestamp;
  }

  factory DetectionLog.fromJson(Map<String, dynamic> json) {
    return DetectionLog(
      id: (json['id'] as num?)?.toInt() ?? 0,
      logId: (json['logId'] as String?) ?? '',
      timestamp: (json['timestamp'] as String?) ?? '',
      plateNumber: (json['plateNumber'] as String?) ?? '',
      cameraId: (json['cameraId'] as String?) ?? '',
      cameraName: (json['cameraName'] as String?) ?? '',
      location: (json['location'] as String?) ?? '',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      isHotlistMatch: json['isHotlistMatch'] == true,
      threatLevel: (json['threatLevel'] as String?) ?? '',
      vehicleDetails: (json['vehicleDetails'] as String?) ?? '',
      status: (json['status'] as String?) ?? '',
      snapshot: (json['snapshot'] as String?) ?? '',
      nodeId: (json['nodeId'] as num?)?.toInt() ?? 0,
      sessionId: (json['sessionId'] as String?) ?? '',
      trackId: (json['trackId'] as num?)?.toInt(),
      vehicleType: (json['vehicleType'] as String?) ?? '',
      vehicleConfidence: (json['vehicleConfidence'] as num?)?.toDouble() ?? 0,
      ocrConfidence: (json['ocrConfidence'] as num?)?.toDouble() ?? 0,
      crimeMatch: json['crimeMatch'] == true,
    );
  }
}
