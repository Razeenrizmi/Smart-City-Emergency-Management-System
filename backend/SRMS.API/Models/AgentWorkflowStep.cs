using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class AgentWorkflowStep
{
    public Guid Id { get; set; }

    public Guid WorkflowRunId { get; set; }

    public string AgentName { get; set; } = null!;

    public int StepIndex { get; set; }

    public string? InputJson { get; set; }

    public string? OutputJson { get; set; }

    public string? ToolCallsJson { get; set; }

    public string? ValidationResult { get; set; }

    public int DurationMs { get; set; }

    public DateTime Timestamp { get; set; }

    public virtual AgentWorkflowRun WorkflowRun { get; set; } = null!;
}
