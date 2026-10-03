using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class TelemetryReading
{
    public Guid Id { get; set; }

    public Guid CameraSensorId { get; set; }

    public Guid IntersectionId { get; set; }

    public DateTime Timestamp { get; set; }

    public int VehicleCount { get; set; }

    public int QueueLength { get; set; }

    public double LaneDensityPercent { get; set; }

    public virtual CameraSensor CameraSensor { get; set; } = null!;

    public virtual Intersection Intersection { get; set; } = null!;
}
