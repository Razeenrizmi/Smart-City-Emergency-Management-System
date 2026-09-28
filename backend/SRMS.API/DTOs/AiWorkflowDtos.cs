namespace SRMS.API.DTOs;

public class ApprovalDecisionRequest
{
    public string? OperatorId { get; set; }

    public string? Notes { get; set; }
}

public class PersistedJunctionAction
{
    public string JunctionId { get; set; } = string.Empty;

    public string JunctionName { get; set; } = string.Empty;

    public int SequenceOrder { get; set; }

    public string Action { get; set; } = string.Empty;

    public string TargetSignalState { get; set; } = string.Empty;

    public int HoldDurationSeconds { get; set; }
}

public class AiWorkflowResponse
{
    public Guid WorkflowId { get; set; }

    public Guid SessionId { get; set; }

    public string? ThreadId { get; set; }

    public string? ProposalId { get; set; }

    public string Objective { get; set; } = string.Empty;

    public string? CurrentStage { get; set; }

    public List<string> CompletedSteps { get; set; } = new();

    public string WorkflowStatus { get; set; } = string.Empty;

    public string ProposalStatus { get; set; } = string.Empty;

    public string ApprovalStatus { get; set; } = string.Empty;

    public bool IsValid { get; set; }

    public bool HandoffReady { get; set; }

    public bool SignalExecutionPerformed { get; set; }

    public List<string> ValidationNotes { get; set; } = new();

    public List<PersistedJunctionAction> ProposedActions { get; set; } = new();

    public string? ErrorSummary { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public string? ApprovalNotes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public class GreenWaveExecutionSummary
{
    public string Status { get; set; } = "NOT_STARTED";

    public DateTime? ActivatedAt { get; set; }

    public DateTime? RestoredAt { get; set; }

    public List<ActivatedJunctionInfo> Junctions { get; set; } = new();

    public List<RestoredJunctionInfo> RestoredJunctions { get; set; } = new();
}

public class AiDecisionReportResponse
{
    public EmergencySessionResponse Emergency { get; set; } = new();

    public RouteResponse? Route { get; set; }

    public AiWorkflowResponse? Workflow { get; set; }

    public GreenWaveExecutionSummary GreenWave { get; set; } = new();

    public string? ErrorSummary { get; set; }
}

public class PythonApprovalRequest
{
    public string? OperatorId { get; set; }

    public string? Notes { get; set; }
}

public class PythonApprovalResponse
{
    public string ThreadId { get; set; } = string.Empty;

    public string ApprovalStatus { get; set; } = string.Empty;

    public string ProposalStatus { get; set; } = string.Empty;

    public bool IsValid { get; set; }

    public bool HandoffReady { get; set; }

    public bool SignalExecutionPerformed { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public string? ApprovalNotes { get; set; }

    public string Message { get; set; } = string.Empty;
}
