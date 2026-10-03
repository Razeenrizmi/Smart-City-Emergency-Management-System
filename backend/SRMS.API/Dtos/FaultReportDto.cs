namespace SRMS.API.Dtos;

public record CreateFaultReportRequest(string Description);

public record FaultReportDto(
    Guid Id,
    Guid CameraSensorId,
    string LaneLabel,
    Guid IntersectionId,
    string IntersectionName,
    string Description,
    string Status,
    DateTime ReportedAt,
    DateTime? ResolvedAt);
