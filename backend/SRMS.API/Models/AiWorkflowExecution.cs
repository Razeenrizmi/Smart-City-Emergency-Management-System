using System.ComponentModel.DataAnnotations;

namespace SRMS.API.Models;

/// <summary>
/// Tracks AI workflow executions — image classification, analyst runs, and chat queries.
/// </summary>
public class AiWorkflowExecution
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Linked hazard report (nullable for chat-only queries).</summary>
    public Guid? HazardReportId { get; set; }

    /// <summary>Type: VISION_CLASSIFY | ANALYST_INSIGHTS | CHAT_QUERY</summary>
    public string WorkflowType { get; set; } = "VISION_CLASSIFY";

    /// <summary>Kept for backward compatibility — describes the domain objective.</summary>
    public string DomainObjective { get; set; } = string.Empty;

    public string ExecutionPlanJson { get; set; } = string.Empty;

    /// <summary>Raw AI query or image base64 input (truncated for storage).</summary>
    public string? InputPayload { get; set; }

    /// <summary>AI response JSON or text output.</summary>
    public string? OutputPayload { get; set; }

    public double? ConfidenceScore { get; set; }
    public string? DetectedCategory { get; set; }
    public bool WasAutoVerified { get; set; } = false;

    /// <summary>Approval status: Pending | Approved | Rejected</summary>
    public string ApprovalStatus { get; set; } = "Pending";

    public long ProcessingMs { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}