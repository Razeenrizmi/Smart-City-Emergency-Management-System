namespace SRMS.API.DTOs;

public class EmergencyCompletionResponse
{
    public Guid SessionId { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool GreenWaveRestored { get; set; }
    public List<RestoredJunctionInfo> RestoredJunctions { get; set; } = new List<RestoredJunctionInfo>();
}

public class RestoredJunctionInfo
{
    public Guid JunctionId { get; set; }
    public string JunctionName { get; set; } = string.Empty;
    public string RestoredSignalState { get; set; } = string.Empty;
}
