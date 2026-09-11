namespace SRMS.API.Models;

public class PatrolUnit
{
    public int Id { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string Callsign { get; set; } = string.Empty;
    public string LeadOfficer { get; set; } = string.Empty;
    public string Sector { get; set; } = string.Empty;
    public string Status { get; set; } = "AVAILABLE";
    public string VehicleType { get; set; } = string.Empty;
    public string DistanceToAlert { get; set; } = string.Empty;
    public string Eta { get; set; } = string.Empty;
}
