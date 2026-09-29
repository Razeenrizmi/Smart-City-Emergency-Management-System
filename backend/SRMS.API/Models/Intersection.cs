using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class Intersection
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public int LaneCount { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<AgentWorkflowRun> AgentWorkflowRuns { get; set; } = new List<AgentWorkflowRun>();

    public virtual ICollection<CameraSensor> CameraSensors { get; set; } = new List<CameraSensor>();

    public virtual ICollection<SignalTimingProposal> SignalTimingProposals { get; set; } = new List<SignalTimingProposal>();

    public virtual ICollection<TelemetryReading> TelemetryReadings { get; set; } = new List<TelemetryReading>();
}
