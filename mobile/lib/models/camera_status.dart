// Mirrors backend/SRMS.API/Dtos/IntersectionSummaryDto.cs's CameraStatusDto,
// returned by GET /api/intersections/{id}/cameras — one row per road
// (camera sensor) at a junction.
class CameraStatus {
  final String cameraSensorId;
  final String laneLabel;
  final int? vehicleCount;
  final double? laneDensityPercent;
  final String? congestionLevel;
  final DateTime? lastUpdated;

  CameraStatus({
    required this.cameraSensorId,
    required this.laneLabel,
    this.vehicleCount,
    this.laneDensityPercent,
    this.congestionLevel,
    this.lastUpdated,
  });

  factory CameraStatus.fromJson(Map<String, dynamic> json) {
    return CameraStatus(
      cameraSensorId: json['cameraSensorId'] as String,
      laneLabel: json['laneLabel'] as String,
      vehicleCount: json['vehicleCount'] as int?,
      laneDensityPercent: (json['laneDensityPercent'] as num?)?.toDouble(),
      congestionLevel: json['congestionLevel'] as String?,
      lastUpdated: json['lastUpdated'] != null ? DateTime.parse(json['lastUpdated'] as String) : null,
    );
  }
}
