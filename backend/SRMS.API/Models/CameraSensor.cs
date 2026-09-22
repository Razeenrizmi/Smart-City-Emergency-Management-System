using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class CameraSensor
{
    public Guid Id { get; set; }

    public Guid IntersectionId { get; set; }

    public string LaneLabel { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime InstalledAt { get; set; }

    public virtual Intersection Intersection { get; set; } = null!;

    public virtual ICollection<SensorFaultReport> SensorFaultReports { get; set; } = new List<SensorFaultReport>();

    public virtual ICollection<TelemetryReading> TelemetryReadings { get; set; } = new List<TelemetryReading>();
}
