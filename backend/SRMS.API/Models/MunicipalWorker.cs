using System.ComponentModel.DataAnnotations;

namespace SRMS.API.Models;

/// <summary>
/// A municipal field worker that repair work can be assigned to.
/// </summary>
public class MunicipalWorker
{
    [Key]
    public Guid WorkerId { get; set; } = Guid.NewGuid();

    public string FullName { get; set; } = string.Empty;

    /// <summary>ROAD_REPAIR | DRAINAGE | ELECTRICAL | GENERAL</summary>
    public string Specialty { get; set; } = "ROAD_REPAIR";

    public string? Phone { get; set; }
    public string? Email { get; set; }

    /// <summary>AVAILABLE | BUSY | INACTIVE</summary>
    public string Status { get; set; } = "AVAILABLE";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
