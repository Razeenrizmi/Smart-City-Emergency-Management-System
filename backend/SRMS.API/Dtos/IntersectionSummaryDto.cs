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
