namespace SRMS.API.Dtos;

public record IntersectionSummaryDto(
    Guid Id,
    string Name,
    int LaneCount,
    double Latitude,
    double Longitude,
    int? TotalVehicleCount,
    double? AverageLaneDensityPercent,
    string? CongestionLevel,
    DateTime? LastUpdated);

// One row per camera sensor (road) at a junction — the real, per-road
// breakdown behind IntersectionSummaryDto's aggregate totals. Backs the
// "live preview" style road-by-road view (e.g. on the Flutter mobile app),
// since the real schema has no stored signal state — a road's "currently
// green" is a client-side simulator concept only, not persisted data.
public record CameraStatusDto(
    Guid CameraSensorId,
    string LaneLabel,
    int? VehicleCount,
    double? LaneDensityPercent,
    string? CongestionLevel,
    DateTime? LastUpdated);
