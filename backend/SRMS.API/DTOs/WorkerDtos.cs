namespace SRMS.API.DTOs;

public class WorkerDto
{
    public Guid WorkerId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Status { get; set; } = string.Empty;
    public int ActiveJobs { get; set; }
    /// <summary>True when this worker has a login account they can sign in with.</summary>
    public bool HasLogin { get; set; }
    public string? Username { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateWorkerRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Specialty { get; set; } = "ROAD_REPAIR";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Status { get; set; } = "AVAILABLE";

    /// <summary>Optional login username. When supplied, a MUNICIPAL_WORKER account is created.</summary>
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public class UpdateWorkerRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Specialty { get; set; } = "ROAD_REPAIR";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Status { get; set; } = "AVAILABLE";

    /// <summary>Set/change the login username. Ignored when blank.</summary>
    public string? Username { get; set; }
    /// <summary>Set/reset the login password. Ignored when blank.</summary>
    public string? Password { get; set; }
}
