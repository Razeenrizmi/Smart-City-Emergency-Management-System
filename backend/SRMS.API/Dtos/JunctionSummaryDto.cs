namespace SRMS.API.Dtos;

public record LatestTelemetryDto(int DetectedVehicleCount, string CongestionLevel, DateTime RecordedAt);

public record JunctionSummaryDto(
    Guid Id,
    string JunctionName,
    decimal Latitude,
    decimal Longitude,
    string CurrentSignalState,
    LatestTelemetryDto? LatestTelemetry);
