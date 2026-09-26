namespace SRMS.API.DTOs;

public class CreateWorkOrderRequest
{
    public Guid HazardId { get; set; }
    public Guid WorkerId { get; set; }
    public string Priority { get; set; } = "MEDIUM";
    public string? Notes { get; set; }
}

public class UpdateWorkOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class WorkOrderDto
{
    public Guid WorkOrderId { get; set; }
    public Guid HazardId { get; set; }
    public string HazardType { get; set; } = string.Empty;
    public int SeverityScore { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string? HazardImageUrl { get; set; }
    public Guid WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string WorkerSpecialty { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public Guid AssignedByUserId { get; set; }
    public string AssignedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
