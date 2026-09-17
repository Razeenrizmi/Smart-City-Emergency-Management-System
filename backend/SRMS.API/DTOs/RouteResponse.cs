namespace SRMS.API.DTOs;

public class RouteResponse
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public string StartLocation { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public decimal DistanceKm { get; set; }
    public int EstimatedTimeMinutes { get; set; }
    public string TrafficLevel { get; set; } = string.Empty;
    public List<RouteJunctionResponse> Junctions { get; set; } = new List<RouteJunctionResponse>();
}
