using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SRMS.API.Models;

[Table("ai_workflow_executions")]
public class AiWorkflowExecution
{
    [Key]
    [Column("workflow_id")]
    public Guid WorkflowId { get; set; }

    [Required]
    [Column("session_id")]
    public Guid SessionId { get; set; }

    [MaxLength(200)]
    [Column("thread_id")]
    public string? ThreadId { get; set; }

    [MaxLength(100)]
    [Column("proposal_id")]
    public string? ProposalId { get; set; }

    [Required]
    [MaxLength(300)]
    [Column("objective")]
    public string Objective { get; set; } = string.Empty;

    [MaxLength(100)]
    [Column("current_stage")]
    public string? CurrentStage { get; set; }

    [Column("completed_steps", TypeName = "jsonb")]
    public string? CompletedStepsJson { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("workflow_status")]
    public string WorkflowStatus { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("proposal_status")]
    public string ProposalStatus { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("approval_status")]
    public string ApprovalStatus { get; set; } = string.Empty;

    [Column("is_valid")]
    public bool IsValid { get; set; }

    [Column("handoff_ready")]
    public bool HandoffReady { get; set; }

    [Column("validation_notes", TypeName = "jsonb")]
    public string? ValidationNotesJson { get; set; }

    [Column("proposed_actions", TypeName = "jsonb")]
    public string? ProposedActionsJson { get; set; }

    [MaxLength(500)]
    [Column("error_summary")]
    public string? ErrorSummary { get; set; }

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    [MaxLength(200)]
    [Column("approved_by")]
    public string? ApprovedBy { get; set; }

    [MaxLength(500)]
    [Column("approval_notes")]
    public string? ApprovalNotes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(SessionId))]
    public virtual EmergencySession EmergencySession { get; set; } = null!;
}
