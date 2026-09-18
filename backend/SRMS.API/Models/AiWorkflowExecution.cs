namespace SRMS.API.Models;

// Minimal stub matching the shared ER diagram, so SignalAdjustmentProposal
// has a real table to reference via WorkflowId. The actual Agentic AI
// orchestration (planning, agents, tools, validation) is separate work —
// not built yet. Right now nothing writes rows here.
public class AiWorkflowExecution
{
    public Guid Id { get; set; }
    public string DomainObjective { get; set; } = string.Empty;
    public string ExecutionPlan { get; set; } = "{}"; // jsonb
    public string ApprovalStatus { get; set; } = "PENDING";
    public DateTime CreatedAt { get; set; }
}
