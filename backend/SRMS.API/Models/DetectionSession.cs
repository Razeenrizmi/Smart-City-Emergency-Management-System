namespace SRMS.API.Models;

public class DetectionSession
{
    public int Id { get; set; }
    public string SessionId { get; set; } = string.Empty;   // e.g. NODE1-SESSION-001
    public int NodeId { get; set; }
    public string StartedAt { get; set; } = string.Empty;
    public string? EndedAt { get; set; }
    public string Status { get; set; } = "ACTIVE";          // ACTIVE | ENDED
}
