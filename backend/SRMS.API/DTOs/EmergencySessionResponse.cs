namespace SRMS.API.DTOs;

public class EmergencySessionResponse
{
    public Guid SessionId { get; set; }
    public Guid DriverId { get; set; }
    public string VehicleType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid? SelectedRouteId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
