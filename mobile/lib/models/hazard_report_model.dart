class HazardReportModel {
  final double latitude;
  final double longitude;
  final double accelerometerZSpike;
  final String hazardType;

  const HazardReportModel({
    required this.latitude,
    required this.longitude,
    required this.accelerometerZSpike,
    this.hazardType = 'POTHOLE',
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'accelerometerZSpike': accelerometerZSpike,
        'hazardType': hazardType,
        'severityScore': 1,
        'isVerified': false,
      };
}
