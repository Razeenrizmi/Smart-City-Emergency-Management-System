using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SRMS.API.Models;

[Table("emergency_sessions")]
public class EmergencySession
{
    [Key]
    [Column("session_id")]
    public Guid SessionId { get; set; }

    [Required]
    [Column("driver_id")]
    public Guid DriverId { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("vehicle_type")]
    public string VehicleType { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("status")]
    public string Status { get; set; } = string.Empty;

    [Column("selected_route_id")]
    public Guid? SelectedRouteId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(SelectedRouteId))]
    public virtual TrafficRoute? SelectedRoute { get; set; }

    public virtual ICollection<SignalPreemptionLog> SignalPreemptionLogs { get; set; } = new List<SignalPreemptionLog>();
}
