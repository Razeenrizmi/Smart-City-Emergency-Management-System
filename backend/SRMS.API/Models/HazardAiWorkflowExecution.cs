using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SRMS.API.Models;

/// <summary>
/// Tracks AI workflow executions for the hazard-reporting domain — image classification,
/// analyst runs, and chat queries. The Emergency Green Wave domain keeps its own
/// workflow log on <see cref="Models.AiWorkflowExecution"/> (table "ai_workflow_executions").
/// </summary>
[Table("AiWorkflowExecutions")]
public class HazardAiWorkflowExecution
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Linked hazard report (nullable for chat-only queries).</summary>
    public Guid? HazardReportId { get; set; }

    /// <summary>Type: VISION_CLASSIFY | ANALYST_INSIGHTS | CHAT_QUERY</summary>
    public string WorkflowType { get; set; } = "VISION_CLASSIFY";

    /// <summary>Describes the domain objective.</summary>
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
