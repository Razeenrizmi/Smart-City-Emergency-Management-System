using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class SignalTimingProposal
{
    public Guid Id { get; set; }

    public Guid WorkflowRunId { get; set; }

    public Guid IntersectionId { get; set; }

    public string ProposedPlanJson { get; set; } = null!;

    public string Justification { get; set; } = null!;

    public string SafetyCheckStatus { get; set; } = null!;

    public string? SafetyCheckNotes { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Intersection Intersection { get; set; } = null!;

    public virtual SignalTimingDecision? SignalTimingDecision { get; set; }

    public virtual AgentWorkflowRun WorkflowRun { get; set; } = null!;
}
