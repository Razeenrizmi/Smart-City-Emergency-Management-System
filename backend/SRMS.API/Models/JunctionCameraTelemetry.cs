namespace SRMS.API.Models;

// One row per camera reading. Inserted automatically every 30 seconds by
// CameraTelemetrySimulatorService (the IHostedService) — this is your
// "Backend: auto-insert simulated vehicle counts" task.
public class JunctionCameraTelemetry
{
    public Guid Id { get; set; }
    public Guid JunctionId { get; set; }
    public string CameraId { get; set; } = string.Empty;
    public int DetectedVehicleCount { get; set; }
    public string CongestionLevel { get; set; } = "LOW";
    public DateTime RecordedAt { get; set; }

    public RoadJunction? Junction { get; set; }
}
