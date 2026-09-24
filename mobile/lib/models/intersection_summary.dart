// Mirrors backend/SRMS.API/Dtos/IntersectionSummaryDto.cs, returned by
// GET /api/intersections — the same endpoint the React Junction Control
// Panel uses, so mobile and web never diverge on what "junction status"
// means.
class IntersectionSummary {
  final String id;
  final String name;
  final int laneCount;
  final int? totalVehicleCount;
  final double? averageLaneDensityPercent;
  final String? congestionLevel;
  final DateTime? lastUpdated;

  IntersectionSummary({
    required this.id,
    required this.name,
    required this.laneCount,
    this.totalVehicleCount,
    this.averageLaneDensityPercent,
    this.congestionLevel,
    this.lastUpdated,
  });

  factory IntersectionSummary.fromJson(Map<String, dynamic> json) {
    return IntersectionSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      laneCount: json['laneCount'] as int,
      totalVehicleCount: json['totalVehicleCount'] as int?,
      averageLaneDensityPercent: (json['averageLaneDensityPercent'] as num?)?.toDouble(),
      congestionLevel: json['congestionLevel'] as String?,
      lastUpdated: json['lastUpdated'] != null ? DateTime.parse(json['lastUpdated'] as String) : null,
    );
  }
}
