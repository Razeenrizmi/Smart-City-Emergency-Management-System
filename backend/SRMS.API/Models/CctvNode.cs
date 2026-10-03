namespace SRMS.API.Models;

public class CctvNode
{
    public int Id { get; set; }
    public int NodeId { get; set; }
    public string CameraName { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string CameraType { get; set; } = string.Empty;      // LAPTOP_WEBCAM | MOBILE_CAMERA | NETWORK_STREAM
    public string Status { get; set; } = "OFFLINE";             // OFFLINE | CONNECTING | ONLINE | ERROR | ANALYZING
    public string StreamSource { get; set; } = string.Empty;    // LOCAL_WEBCAM | NETWORK_STREAM | PHONE_CAMERA
    public string StreamUrl { get; set; } = string.Empty;       // configurable network stream URL (no secrets)
    public string CreatedAt { get; set; } = string.Empty;
    public string LastSeenAt { get; set; } = string.Empty;

    // Backend-provided CCTV location (never the phone GPS).
    public double? Lat { get; set; }
    public double? Lng { get; set; }
}
