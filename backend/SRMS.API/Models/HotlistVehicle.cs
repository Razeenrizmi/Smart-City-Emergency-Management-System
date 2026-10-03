namespace SRMS.API.Models;

public class HotlistVehicle
{
    public int Id { get; set; }
    public string VehicleId { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string MakeModel { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string ThreatLevel { get; set; } = string.Empty;
    public string IncidentType { get; set; } = string.Empty;
    public string WantedSince { get; set; } = string.Empty;
    public string LastSeenCamera { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string Status { get; set; } = "WANTED";
    public string Notes { get; set; } = string.Empty;
    public string Image { get; set; } = string.Empty;
}
