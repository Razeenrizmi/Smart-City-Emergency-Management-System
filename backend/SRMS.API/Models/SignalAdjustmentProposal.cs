namespace SRMS.API.Models;

// A suggested green-time extension for a busy junction. IsApprovedByOperator
// is the "proposal toggle" your React panel controls: null = pending,
// true = approved, false = rejected.
public class SignalAdjustmentProposal
{
    public Guid Id { get; set; }
    public Guid JunctionId { get; set; }
    public Guid? WorkflowId { get; set; } // null until the real Agentic AI subsystem generates these
    public int ProposedGreenExtensionSec { get; set; }
    public bool? IsApprovedByOperator { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public RoadJunction? Junction { get; set; }
}
