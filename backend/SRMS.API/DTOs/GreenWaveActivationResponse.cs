namespace SRMS.API.DTOs;

public class GreenWaveActivationResponse
{
    public Guid SessionId { get; set; }
    public Guid? RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<ActivatedJunctionInfo> Junctions { get; set; } = new List<ActivatedJunctionInfo>();
}

public class ActivatedJunctionInfo
{
    public Guid JunctionId { get; set; }
    public string JunctionName { get; set; } = string.Empty;
    public int SequenceNumber { get; set; }
    public string SignalState { get; set; } = string.Empty;
}
