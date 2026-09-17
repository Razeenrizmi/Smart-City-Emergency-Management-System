using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SRMS.API.Models;

[Table("routes")]
public class TrafficRoute
{
    [Key]
    [Column("route_id")]
    public Guid RouteId { get; set; }

    [Required]
    [MaxLength(200)]
    [Column("route_name")]
    public string RouteName { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    [Column("start_location")]
    public string StartLocation { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    [Column("destination")]
    public string Destination { get; set; } = string.Empty;

    [Required]
    [Column("distance_km")]
    public decimal DistanceKm { get; set; }

    [Required]
    [Column("estimated_time_minutes")]
    public int EstimatedTimeMinutes { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("traffic_level")]
    public string TrafficLevel { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual ICollection<EmergencySession> EmergencySessions { get; set; } = new List<EmergencySession>();
    public virtual ICollection<RouteJunction> RouteJunctions { get; set; } = new List<RouteJunction>();
}
