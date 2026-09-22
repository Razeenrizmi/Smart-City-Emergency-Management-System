using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class SensorFaultReport
{
    public Guid Id { get; set; }

    public Guid CameraSensorId { get; set; }

    public Guid ReportedByUserId { get; set; }

    public string Description { get; set; } = null!;

    public string? PhotoUrl { get; set; }

    public string Status { get; set; } = null!;

    public DateTime ReportedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public virtual CameraSensor CameraSensor { get; set; } = null!;

    public virtual User ReportedByUser { get; set; } = null!;
}
