using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class AgentWorkflowRun
{
    public Guid Id { get; set; }

    public Guid IntersectionId { get; set; }

    public string Objective { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? FinalOutcome { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public virtual ICollection<AgentWorkflowStep> AgentWorkflowSteps { get; set; } = new List<AgentWorkflowStep>();

    public virtual Intersection Intersection { get; set; } = null!;

    public virtual ICollection<SignalTimingProposal> SignalTimingProposals { get; set; } = new List<SignalTimingProposal>();
}
