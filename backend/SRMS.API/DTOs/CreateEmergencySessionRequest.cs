using System.ComponentModel.DataAnnotations;

namespace SRMS.API.DTOs;

public class CreateEmergencySessionRequest
{
    [Required]
    public Guid DriverId { get; set; }

    [Required]
    [MaxLength(100)]
    [MinLength(1)]
    public string VehicleType { get; set; } = string.Empty;

    public Guid? SelectedRouteId { get; set; }
}
