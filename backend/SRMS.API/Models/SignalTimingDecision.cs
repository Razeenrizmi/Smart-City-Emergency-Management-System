using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class SignalTimingDecision
{
    public Guid Id { get; set; }

    public Guid ProposalId { get; set; }

    public Guid DecidedByUserId { get; set; }

    public string Decision { get; set; } = null!;

    public string? Comment { get; set; }

    public DateTime DecidedAt { get; set; }

    public virtual User DecidedByUser { get; set; } = null!;

    public virtual SignalTimingProposal Proposal { get; set; } = null!;
}
