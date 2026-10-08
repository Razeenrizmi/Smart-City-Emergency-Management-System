class HazardReportModel {
  final double latitude;
  final double longitude;
  final double accelerometerZSpike;
  final String hazardType;
  final DateTime? createdAt;

  const HazardReportModel({
    required this.latitude,
    required this.longitude,
    required this.accelerometerZSpike,
    this.hazardType = 'POTHOLE',
    this.createdAt,
  });

  factory HazardReportModel.fromJson(Map<String, dynamic> json) {
    return HazardReportModel(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      accelerometerZSpike: (json['accelerometerZSpike'] as num).toDouble(),
      hazardType: (json['hazardType'] as String?) ?? 'POTHOLE',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> payload = {
      'latitude': latitude,
      'longitude': longitude,
      'accelerometerZSpike': accelerometerZSpike,
      'hazardType': hazardType,
      'severityScore': 1,
      'isVerified': false,
    };
    if (createdAt != null) {
      payload['createdAt'] = createdAt!.toIso8601String();
    }
    return payload;
  }
}
