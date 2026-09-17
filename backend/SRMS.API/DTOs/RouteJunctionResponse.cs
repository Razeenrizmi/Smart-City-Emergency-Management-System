namespace SRMS.API.DTOs;

public class RouteJunctionResponse
{
    public Guid JunctionId { get; set; }
    public string JunctionName { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string CurrentSignalState { get; set; } = string.Empty;
    public int SequenceNumber { get; set; }
}
