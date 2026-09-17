using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SRMS.API.Models;

[Table("route_junctions")]
public class RouteJunction
{
    [Key]
    [Column("route_junction_id")]
    public Guid RouteJunctionId { get; set; }

    [Required]
    [Column("route_id")]
    public Guid RouteId { get; set; }

    [Required]
    [Column("junction_id")]
    public Guid JunctionId { get; set; }

    [Required]
    [Column("sequence_number")]
    public int SequenceNumber { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(RouteId))]
    public virtual TrafficRoute Route { get; set; } = null!;

    [ForeignKey(nameof(JunctionId))]
    public virtual RoadJunction RoadJunction { get; set; } = null!;
}
