using System.ComponentModel.DataAnnotations;

namespace SRMS.API.Models;

/// <summary>
/// Links a hazard report to the municipal worker assigned to repair it.
/// Work orders are created as PENDING_APPROVAL and must be signed off by an
/// officer before the worker starts the job.
/// </summary>
public class RepairWorkOrder
{
    [Key]
    public Guid WorkOrderId { get; set; } = Guid.NewGuid();

    public Guid HazardId { get; set; }
    public RoadHazardReport? Hazard { get; set; }

    public Guid WorkerId { get; set; }
    public MunicipalWorker? Worker { get; set; }

    /// <summary>Officer who created the dispatch request.</summary>
    public Guid AssignedByUserId { get; set; }

    /// <summary>Snapshot of the assigning officer's name (avoids joining AppUser).</summary>
    public string AssignedByName { get; set; } = string.Empty;

    /// <summary>LOW | MEDIUM | HIGH | CRITICAL</summary>
    public string Priority { get; set; } = "MEDIUM";

    /// <summary>PENDING_APPROVAL | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED</summary>
    public string Status { get; set; } = "PENDING_APPROVAL";

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
