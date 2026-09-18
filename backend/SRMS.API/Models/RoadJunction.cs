namespace SRMS.API.Models;

// Shared across every member's feature (green-wave routing, camera
// telemetry, etc.) — this is the junction itself, not any one feature's
// data about it.
public class RoadJunction
{
    public Guid Id { get; set; }
    public string JunctionName { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string CurrentSignalState { get; set; } = "UNKNOWN";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<JunctionCameraTelemetry> TelemetryReadings { get; set; } = [];
    public List<SignalAdjustmentProposal> Proposals { get; set; } = [];
}
