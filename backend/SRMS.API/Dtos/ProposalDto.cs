namespace SRMS.API.Dtos;

public record ProposalDto(
    Guid Id,
    Guid IntersectionId,
    string IntersectionName,
    string Justification,
    string SafetyCheckStatus,
    string? SafetyCheckNotes,
    DateTime CreatedAt,
    string? Decision,
    DateTime? DecidedAt);
