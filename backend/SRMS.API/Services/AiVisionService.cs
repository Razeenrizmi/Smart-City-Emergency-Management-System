using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Services;

/// <summary>
/// Simulates a Computer Vision classifier that analyses road hazard images.
/// In a production system this would call a Python ML micro-service or Azure CV endpoint.
/// The current implementation uses deterministic heuristics on the base64 payload
/// so the rest of the system can be fully functional without an external ML dependency.
/// </summary>
public class AiVisionService
{
    private static readonly string[] Categories = ["POTHOLE", "ROAD_CRACK", "DEBRIS", "FLOODING", "SURFACE_DAMAGE"];

    private readonly AppDbContext _db;
    private readonly ILogger<AiVisionService> _logger;

    // Confidence threshold above which a report is auto-verified
    private const double AutoVerifyThreshold = 0.75;

    public AiVisionService(AppDbContext db, ILogger<AiVisionService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Classify a hazard image from a base64-encoded string.
    /// Returns the detected category, confidence, summary, and whether auto-verified.
    /// </summary>
    public async Task<AiVisionResult> ClassifyImageAsync(
        string imageBase64,
        Guid? hazardReportId = null,
        double accelerometerSpike = 0.0)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        // ── Simulate CV inference ─────────────────────────────────────────────
        // We derive a pseudo-random but deterministic confidence score from the
        // image hash so repeated calls with the same image return the same result.
        var hash = imageBase64.Length > 0 ? Math.Abs(imageBase64.GetHashCode()) : new Random().Next();
        var rng = new Random(hash);

        var categoryIndex = rng.Next(Categories.Length);
        var category = Categories[categoryIndex];

        // Higher accelerometer spike → higher confidence (sensor corroboration)
        double baseConf = 0.72 + rng.NextDouble() * 0.26;         // 0.72 – 0.98
        if (accelerometerSpike >= 18.0) baseConf = Math.Min(baseConf + 0.08, 0.99);
        else if (accelerometerSpike >= 14.0) baseConf = Math.Min(baseConf + 0.04, 0.99);
        double confidence = Math.Round(baseConf, 2);

        bool autoVerified = confidence >= AutoVerifyThreshold;

        var summary = BuildSummary(category, confidence, accelerometerSpike, autoVerified);

        sw.Stop();

        // ── Persist workflow log ──────────────────────────────────────────────
        var execution = new AiWorkflowExecution
        {
            HazardReportId = hazardReportId,
            WorkflowType = "VISION_CLASSIFY",
            DomainObjective = "Road hazard image classification",
            InputPayload = $"[base64 image, length={imageBase64.Length}]",
            OutputPayload = System.Text.Json.JsonSerializer.Serialize(new { category, confidence, autoVerified }),
            ConfidenceScore = confidence,
            DetectedCategory = category,
            WasAutoVerified = autoVerified,
            ApprovalStatus = autoVerified ? "Approved" : "Pending",
            ProcessingMs = sw.ElapsedMilliseconds,
        };
        _db.AiWorkflowExecutions.Add(execution);
        await _db.SaveChangesAsync();

        _logger.LogInformation("[AiVision] Category={Category} Confidence={Confidence} Verified={Verified} in {Ms}ms",
            category, confidence, autoVerified, sw.ElapsedMilliseconds);

        return new AiVisionResult
        {
            DetectedCategory = category,
            ConfidenceScore = confidence,
            IsAutoVerified = autoVerified,
            AnalysisSummary = summary,
            ProcessingMs = sw.ElapsedMilliseconds,
        };
    }

    private static string BuildSummary(string category, double confidence, double spike, bool verified)
    {
        var verifiedText = verified ? "AI auto-verified" : "Requires manual review";
        var spikeText = spike > 0 ? $" Accelerometer spike: {spike:F1} m/s²." : string.Empty;
        return category switch
        {
            "POTHOLE"        => $"Deep pothole detected with {confidence:P0} confidence.{spikeText} {verifiedText}.",
            "ROAD_CRACK"     => $"Longitudinal road crack identified ({confidence:P0} confidence).{spikeText} {verifiedText}.",
            "DEBRIS"         => $"Road debris or obstruction found ({confidence:P0} confidence).{spikeText} {verifiedText}.",
            "FLOODING"       => $"Surface flooding or water pooling detected ({confidence:P0} confidence).{spikeText} {verifiedText}.",
            "SURFACE_DAMAGE" => $"General surface damage classified ({confidence:P0} confidence).{spikeText} {verifiedText}.",
            _                => $"Unclassified hazard detected ({confidence:P0} confidence).{spikeText} {verifiedText}.",
        };
    }
}

public class AiVisionResult
{
    public string DetectedCategory { get; set; } = string.Empty;
    public double ConfidenceScore { get; set; }
    public bool IsAutoVerified { get; set; }
    public string AnalysisSummary { get; set; } = string.Empty;
    public long ProcessingMs { get; set; }
}
