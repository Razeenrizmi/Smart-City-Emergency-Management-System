using System.ComponentModel.DataAnnotations;

namespace SRMS.API.Models;

public class RoadHazardReport
{
    [Key]
    public Guid HazardId { get; set; } = Guid.NewGuid();
    public Guid? ReportedByUserId { get; set; }

    [Range(typeof(decimal), "-90", "90", ErrorMessage = "Latitude must be between -90 and 90.")]
    public decimal Latitude { get; set; }

    [Range(typeof(decimal), "-180", "180", ErrorMessage = "Longitude must be between -180 and 180.")]
    public decimal Longitude { get; set; }
    public decimal AccelerometerZSpike { get; set; }
    public string? ImageUrl { get; set; }
    public int SeverityScore { get; set; } = 1; // 1 (Minor) to 5 (Severe)
    public string HazardType { get; set; } = "POTHOLE";
    public bool IsVerified { get; set; } = false;

    /// <summary>Officer review state: PENDING | APPROVED | REJECTED | RESOLVED. Only APPROVED hazards can be assigned; RESOLVED hazards are hidden from the live map.</summary>
    public string ApprovalStatus { get; set; } = "PENDING";

    public double AiConfidenceScore { get; set; } = 0.0;
    public string? AiDetectedCategory { get; set; }
    public string? AiAnalysisSummary { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}