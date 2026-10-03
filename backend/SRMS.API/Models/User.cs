using System;
using System.Collections.Generic;

namespace SRMS.API.Models;

public partial class User
{
    public Guid Id { get; set; }

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string Role { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<SensorFaultReport> SensorFaultReports { get; set; } = new List<SensorFaultReport>();

    public virtual ICollection<SignalTimingDecision> SignalTimingDecisions { get; set; } = new List<SignalTimingDecision>();
}
