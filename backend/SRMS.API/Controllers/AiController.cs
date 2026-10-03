using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Services;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly AiVisionService _vision;
    private readonly AiAnalystService _analyst;
    private readonly AppDbContext _db;

    public AiController(AiVisionService vision, AiAnalystService analyst, AppDbContext db)
    {
        _vision = vision;
        _analyst = analyst;
        _db = db;
    }

    // ─── POST /api/ai/classify-image ─────────────────────────────────────────
    /// <summary>
    /// Classifies a hazard image and returns AI verification results.
    /// If hazardReportId is provided, the linked report is updated with AI data.
    /// </summary>
    [HttpPost("classify-image")]
    public async Task<IActionResult> ClassifyImage([FromBody] ClassifyImageRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ImageBase64))
            return BadRequest(new { success = false, error = "imageBase64 is required." });

        var result = await _vision.ClassifyImageAsync(
            req.ImageBase64,
            req.HazardReportId,
            req.AccelerometerSpike);

        // Update the linked hazard report if provided
        if (req.HazardReportId.HasValue)
        {
            var report = await _db.RoadHazardReports.FindAsync(req.HazardReportId.Value);
            if (report != null)
            {
                report.AiDetectedCategory = result.DetectedCategory;
                report.AiConfidenceScore = result.ConfidenceScore;
                report.AiAnalysisSummary = result.AnalysisSummary;
                report.HazardType = result.DetectedCategory;          // override with AI classification
                if (result.IsAutoVerified)
                {
                    report.IsVerified = true;
                    report.ApprovalStatus = "APPROVED";
                }
                await _db.SaveChangesAsync();
            }
        }

        return Ok(new
        {
            success = true,
            data = new
            {
                detectedCategory = result.DetectedCategory,
                confidenceScore = result.ConfidenceScore,
                isAutoVerified = result.IsAutoVerified,
                analysisSummary = result.AnalysisSummary,
                processingMs = result.ProcessingMs,
            }
        });
    }

    // ─── GET /api/ai/insights ─────────────────────────────────────────────────
    /// <summary>Returns city-wide AI risk score, hazard clusters, and dispatch advisories.</summary>
    [HttpGet("insights")]
    public async Task<IActionResult> GetInsights()
    {
        var insights = await _analyst.GetCityInsightsAsync();
        return Ok(new { success = true, data = insights });
    }

    // ─── POST /api/ai/chat ────────────────────────────────────────────────────
    /// <summary>Interactive admin copilot endpoint for natural-language queries.</summary>
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Prompt))
            return BadRequest(new { success = false, error = "prompt is required." });

        var response = await _analyst.ProcessChatAsync(req.Prompt);
        return Ok(new { success = true, data = response });
    }
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

public class ClassifyImageRequest
{
    /// <summary>Base64-encoded image data.</summary>
    public string ImageBase64 { get; set; } = string.Empty;

    /// <summary>Optional hazard report to update with classification results.</summary>
    public Guid? HazardReportId { get; set; }

    /// <summary>Accelerometer Z-spike value to boost AI confidence scoring.</summary>
    public double AccelerometerSpike { get; set; } = 0.0;
}

public class AiChatRequest
{
    public string Prompt { get; set; } = string.Empty;
}
