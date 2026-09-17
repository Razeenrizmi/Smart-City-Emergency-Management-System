using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SRMS.API.Models;

[Table("signal_preemption_logs")]
public class SignalPreemptionLog
{
    [Key]
    [Column("log_id")]
    public Guid LogId { get; set; }

    [Required]
    [Column("session_id")]
    public Guid SessionId { get; set; }

    [Required]
    [Column("junction_id")]
    public Guid JunctionId { get; set; }

    [Required]
    [Column("is_active")]
    public bool IsActive { get; set; }

    [Column("activated_at")]
    public DateTime? ActivatedAt { get; set; }

    [Column("deactivated_at")]
    public DateTime? DeactivatedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(SessionId))]
    public virtual EmergencySession EmergencySession { get; set; } = null!;

    [ForeignKey(nameof(JunctionId))]
    public virtual RoadJunction RoadJunction { get; set; } = null!;
}
