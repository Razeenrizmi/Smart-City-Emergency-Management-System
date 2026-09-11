namespace SRMS.API.Models;

public class DetectionLog
{
    public int Id { get; set; }
    public string LogId { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string CameraId { get; set; } = string.Empty;
    public string CameraName { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string Speed { get; set; } = string.Empty;
    public string Direction { get; set; } = string.Empty;
    public bool IsHotlistMatch { get; set; }
    public string ThreatLevel { get; set; } = string.Empty;
    public string VehicleDetails { get; set; } = string.Empty;
    public string Status { get; set; } = "CLEARED";
    public string Snapshot { get; set; } = string.Empty;
}
