using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SRMS.API.Models;

[Table("road_junctions")]
public class RoadJunction
{
    [Key]
    [Column("junction_id")]
    public Guid JunctionId { get; set; }

    [Required]
    [MaxLength(200)]
    [Column("junction_name")]
    public string JunctionName { get; set; } = string.Empty;

    [Required]
    [Column("latitude")]
    public decimal Latitude { get; set; }

    [Required]
    [Column("longitude")]
    public decimal Longitude { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("current_signal_state")]
    public string CurrentSignalState { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual ICollection<RouteJunction> RouteJunctions { get; set; } = new List<RouteJunction>();
    public virtual ICollection<SignalPreemptionLog> SignalPreemptionLogs { get; set; } = new List<SignalPreemptionLog>();
}
