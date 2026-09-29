namespace SRMS.API.Models;

public class Camera
{
    public int Id { get; set; }
    public string CameraId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Zone { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string Resolution { get; set; } = string.Empty;
    public int Fps { get; set; }
    public int ScannedToday { get; set; }
    public string LastPlate { get; set; } = string.Empty;
    public string LastScanTime { get; set; } = string.Empty;
}
