class ScanResult {
  final String detectedPlate;
  final double confidence;
  final String vehicleInfo;
  final bool isMatch;
  final HotlistMatch? matchedVehicle;
  final String scannedAt;

  ScanResult({
    required this.detectedPlate,
    required this.confidence,
    required this.vehicleInfo,
    required this.isMatch,
    this.matchedVehicle,
    required this.scannedAt,
  });

  factory ScanResult.fromJson(Map<String, dynamic> json) {
    return ScanResult(
      detectedPlate: json['detectedPlate'] ?? '',
      confidence: (json['confidence'] ?? 0).toDouble(),
      vehicleInfo: json['vehicleInfo'] ?? '',
      isMatch: json['isMatch'] ?? false,
      matchedVehicle: json['matchedVehicle'] != null
          ? HotlistMatch.fromJson(json['matchedVehicle'])
          : null,
      scannedAt: json['scannedAt'] ?? '',
    );
  }
}

class HotlistMatch {
  final String plateNumber;
  final String makeModel;
  final String color;
  final String threatLevel;
  final String incidentType;
  final String status;
  final String notes;

  HotlistMatch({
    required this.plateNumber,
    required this.makeModel,
    required this.color,
    required this.threatLevel,
    required this.incidentType,
    required this.status,
    required this.notes,
  });

  factory HotlistMatch.fromJson(Map<String, dynamic> json) {
    return HotlistMatch(
      plateNumber: json['plateNumber'] ?? '',
      makeModel: json['makeModel'] ?? '',
      color: json['color'] ?? '',
      threatLevel: json['threatLevel'] ?? '',
      incidentType: json['incidentType'] ?? '',
      status: json['status'] ?? '',
      notes: json['notes'] ?? '',
    );
  }
}
