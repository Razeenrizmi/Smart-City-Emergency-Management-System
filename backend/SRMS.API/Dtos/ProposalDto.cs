namespace SRMS.API.Dtos;

public record ProposalDto(
    Guid Id,
    Guid IntersectionId,
    string IntersectionName,
    Guid WorkflowRunId,
    string Justification,
    string ProposedPlanJson,
    string SafetyCheckStatus,
    string? SafetyCheckNotes,
    DateTime CreatedAt,
    string? Decision,
    DateTime? DecidedAt);

public record AgentWorkflowStepDto(
    string AgentName,
    int StepIndex,
    string InputJson,
    string OutputJson,
    string? ToolCallsJson,
    string ValidationResult,
    int DurationMs,
    DateTime Timestamp);
