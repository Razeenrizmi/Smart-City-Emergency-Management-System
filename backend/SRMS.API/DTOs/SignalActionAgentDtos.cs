namespace SRMS.API.DTOs;

/// <summary>
/// Request body for the Python Signal Action Agent
/// POST /api/v1/agent/propose-signals (snake_case JSON on the wire).
/// </summary>
public class SignalActionAgentRequest
{
    public string EmergencySessionId { get; set; } = string.Empty;

    public string VehicleId { get; set; } = string.Empty;

    public string VehicleType { get; set; } = string.Empty;

    public string RouteId { get; set; } = string.Empty;

    public string RouteName { get; set; } = string.Empty;

    public List<JunctionInput> OrderedJunctions { get; set; } = new();

    public Dictionary<string, string>? CurrentSignalStates { get; set; }

    public string? ThreadId { get; set; }
}

/// <summary>
/// Junction telemetry matching Python JunctionInput.
/// </summary>
public class JunctionInput
{
    public string JunctionId { get; set; } = string.Empty;

    public string JunctionName { get; set; } = string.Empty;

    public int SequenceOrder { get; set; }

    public double? DistanceMeters { get; set; }

    public string? CurrentSignalState { get; set; }
}

/// <summary>
/// Structured proposal matching Python SignalActionProposalResponse.
/// signal_execution_performed is not part of this Python response contract.
/// </summary>
public class SignalActionProposalResponse
{
    public string ProposalId { get; set; } = string.Empty;

    public string EmergencySessionId { get; set; } = string.Empty;

    public string RouteId { get; set; } = string.Empty;

    public string RouteName { get; set; } = string.Empty;

    public string VehicleId { get; set; } = string.Empty;

    public string VehicleType { get; set; } = string.Empty;

    public string ProposalStatus { get; set; } = string.Empty;

    public string ApprovalStatus { get; set; } = string.Empty;

    public bool HandoffReady { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public string? ApprovalNotes { get; set; }

    public string? WorkflowStatus { get; set; }

    public string? ThreadId { get; set; }

    public List<JunctionAction> ProposedJunctionActions { get; set; } = new();

    public string Reason { get; set; } = string.Empty;

    public List<string> ValidationNotes { get; set; } = new();

    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Junction action matching Python JunctionAction.
/// </summary>
public class JunctionAction
{
    public string JunctionId { get; set; } = string.Empty;

    public string JunctionName { get; set; } = string.Empty;

    public int SequenceOrder { get; set; }

    public string Action { get; set; } = string.Empty;

    public string TargetSignalState { get; set; } = string.Empty;

    public int HoldDurationSeconds { get; set; }

    public string Reason { get; set; } = string.Empty;
}
