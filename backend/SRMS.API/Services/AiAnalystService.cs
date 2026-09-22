using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Services;

/// <summary>
/// AI Analyst Engine — spatial clustering, Road Danger Index (RDI), and natural-language chat.
/// </summary>
public class AiAnalystService
{
    private const double ClusterRadiusMeters = 500.0;
    private readonly AppDbContext _db;
    private readonly ILogger<AiAnalystService> _logger;

    public AiAnalystService(AppDbContext db, ILogger<AiAnalystService> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Computes city-wide AI insights: RDI, clusters, top risks.</summary>
    public async Task<AiInsightsResult> GetCityInsightsAsync()
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var hazards = await _db.RoadHazardReports.AsNoTracking().ToListAsync();

        var clusters = BuildClusters(hazards);
        double rdi = ComputeRdi(hazards);
        double verifiedPct = hazards.Count > 0
            ? Math.Round(hazards.Count(h => h.IsVerified) / (double)hazards.Count * 100, 1)
            : 0.0;

        var topRisks = clusters
            .OrderByDescending(c => c.AverageRdi)
            .Take(3)
            .Select(c => $"{c.HazardCount} hazards near ({c.CenterLat:F4}, {c.CenterLon:F4}) — RDI {c.AverageRdi:F0}")
            .ToList();

        var advisories = BuildAdvisories(clusters, rdi);

        sw.Stop();

        // Log
        var log = new AiWorkflowExecution
        {
            WorkflowType = "ANALYST_INSIGHTS",
            DomainObjective = "City-wide risk analysis",
            OutputPayload = $"RDI={rdi:F1} Clusters={clusters.Count} Hazards={hazards.Count}",
            ProcessingMs = sw.ElapsedMilliseconds,
            ApprovalStatus = "Approved",
        };
        _db.AiWorkflowExecutions.Add(log);
        await _db.SaveChangesAsync();

        return new AiInsightsResult
        {
            CityRoadDangerIndex = rdi,
            TotalHazards = hazards.Count,
            VerifiedHazardsPercent = verifiedPct,
            TotalClusters = clusters.Count,
            Clusters = clusters,
            TopRiskDescriptions = topRisks,
            DispatchAdvisories = advisories,
        };
    }

    /// <summary>Processes a natural-language admin query and returns a structured AI response.</summary>
    public async Task<AiChatResponse> ProcessChatAsync(string userPrompt)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var hazards = await _db.RoadHazardReports.AsNoTracking().ToListAsync();

        var response = GenerateChatResponse(userPrompt, hazards);

        sw.Stop();

        var log = new AiWorkflowExecution
        {
            WorkflowType = "CHAT_QUERY",
            DomainObjective = "Admin copilot chat",
            InputPayload = userPrompt.Length > 500 ? userPrompt[..500] : userPrompt,
            OutputPayload = response.Message.Length > 500 ? response.Message[..500] : response.Message,
            ProcessingMs = sw.ElapsedMilliseconds,
            ApprovalStatus = "Approved",
        };
        _db.AiWorkflowExecutions.Add(log);
        await _db.SaveChangesAsync();

        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Clustering (greedy distance-based)
    // ─────────────────────────────────────────────────────────────────────────

    private List<HazardCluster> BuildClusters(List<RoadHazardReport> hazards)
    {
        var unassigned = hazards.ToList();
        var clusters = new List<HazardCluster>();

        while (unassigned.Count > 0)
        {
            var seed = unassigned[0];
            unassigned.RemoveAt(0);

            var members = new List<RoadHazardReport> { seed };

            for (int i = unassigned.Count - 1; i >= 0; i--)
            {
                if (HaversineMeters((double)seed.Latitude, (double)seed.Longitude,
                        (double)unassigned[i].Latitude, (double)unassigned[i].Longitude) <= ClusterRadiusMeters)
                {
                    members.Add(unassigned[i]);
                    unassigned.RemoveAt(i);
                }
            }

            double avgLat = members.Average(h => (double)h.Latitude);
            double avgLon = members.Average(h => (double)h.Longitude);
            double avgSeverity = members.Average(h => h.SeverityScore);
            double verifiedRatio = members.Count(h => h.IsVerified) / (double)members.Count;
            double avgSpike = members.Average(h => (double)h.AccelerometerZSpike);

            // Cluster RDI: severity × 10 + verified bonus + spike factor (capped 0-100)
            double clusterRdi = Math.Min(100.0,
                avgSeverity * 14.0 + verifiedRatio * 10.0 + Math.Min(avgSpike, 25.0) * 1.2);

            clusters.Add(new HazardCluster
            {
                ClusterId = Guid.NewGuid(),
                CenterLat = Math.Round(avgLat, 5),
                CenterLon = Math.Round(avgLon, 5),
                HazardCount = members.Count,
                AverageSeverity = Math.Round(avgSeverity, 2),
                AverageRdi = Math.Round(clusterRdi, 1),
                VerifiedCount = members.Count(h => h.IsVerified),
                DominantHazardType = members
                    .GroupBy(h => h.HazardType)
                    .OrderByDescending(g => g.Count())
                    .First().Key,
            });
        }

        return clusters.OrderByDescending(c => c.AverageRdi).ToList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Road Danger Index (city-wide, 0-100)
    // ─────────────────────────────────────────────────────────────────────────

    private static double ComputeRdi(List<RoadHazardReport> hazards)
    {
        if (hazards.Count == 0) return 0.0;

        double severityComponent = hazards.Average(h => h.SeverityScore) * 12.0;       // max 60
        double volumeComponent = Math.Min(hazards.Count * 0.5, 20.0);                  // max 20
        double verifiedComponent = hazards.Count(h => h.IsVerified) / (double)hazards.Count * 10.0; // max 10
        double aiComponent = hazards.Where(h => h.AiConfidenceScore > 0)
                                    .Select(h => h.AiConfidenceScore)
                                    .DefaultIfEmpty(0)
                                    .Average() * 10.0;                                  // max 10

        return Math.Round(Math.Min(severityComponent + volumeComponent + verifiedComponent + aiComponent, 100.0), 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Chat response generation
    // ─────────────────────────────────────────────────────────────────────────

    private AiChatResponse GenerateChatResponse(string prompt, List<RoadHazardReport> hazards)
    {
        var p = prompt.ToLowerInvariant();

        // Severe/worst potholes
        if (p.Contains("worst") || p.Contains("urgent") || p.Contains("severe") || p.Contains("pothole"))
        {
            var top5 = hazards.Where(h => h.SeverityScore >= 4)
                              .OrderByDescending(h => h.SeverityScore)
                              .ThenByDescending(h => h.AiConfidenceScore)
                              .Take(5)
                              .ToList();

            if (top5.Count == 0)
                return Respond("No severe hazards (severity ≥ 4) currently on record. The city looks safe! 🟢",
                               "ALL_CLEAR", []);

            var bullets = top5.Select(h =>
                $"• {h.HazardType} at ({h.Latitude:F4}, {h.Longitude:F4}) — Severity {h.SeverityScore}/5" +
                (h.AiConfidenceScore > 0 ? $", AI confidence {h.AiConfidenceScore:P0}" : ""));

            return Respond(
                $"🚨 Found {top5.Count} severe hazard(s) requiring urgent attention:\n\n" + string.Join("\n", bullets),
                "URGENT_HAZARDS", top5.Select(h => h.HazardId).ToList());
        }

        // Summary
        if (p.Contains("summar") || p.Contains("overview") || p.Contains("report"))
        {
            double rdi = ComputeRdi(hazards);
            int verified = hazards.Count(h => h.IsVerified);
            int severe = hazards.Count(h => h.SeverityScore >= 4);
            return Respond(
                $"📊 City Summary: {hazards.Count} total reports, {severe} severe, {verified} AI-verified. " +
                $"Road Danger Index: {rdi:F0}/100. " +
                (rdi > 60 ? "⚠️ High risk — dispatch crews immediately." : "✅ Risk level is manageable."),
                "SUMMARY", []);
        }

        // Repair order
        if (p.Contains("repair") || p.Contains("fix") || p.Contains("dispatch"))
        {
            var highPriority = hazards.Where(h => h.IsVerified && h.SeverityScore >= 3)
                                      .OrderByDescending(h => h.SeverityScore)
                                      .Take(5)
                                      .ToList();
            if (highPriority.Count == 0)
                return Respond("No verified high-priority hazards found for repair dispatch at this time.", "REPAIR_ORDER", []);

            var lines = highPriority.Select((h, i) =>
                $"{i + 1}. {h.HazardType} at ({h.Latitude:F4}, {h.Longitude:F4}) — Severity {h.SeverityScore}/5 ✅ Verified");

            return Respond(
                $"🔧 Repair Dispatch Order ({highPriority.Count} locations):\n\n" + string.Join("\n", lines),
                "REPAIR_ORDER", highPriority.Select(h => h.HazardId).ToList());
        }

        // Flooding
        if (p.Contains("flood") || p.Contains("water"))
        {
            var floods = hazards.Where(h => h.HazardType.Contains("FLOOD")).ToList();
            if (floods.Count == 0)
                return Respond("No flooding hazards detected in the current dataset.", "FLOODING", []);
            return Respond($"🌊 {floods.Count} flooding reports detected. Immediate drainage inspection advised.", "FLOODING",
                floods.Select(h => h.HazardId).ToList());
        }

        // Default — general city status
        {
            double rdi = ComputeRdi(hazards);
            return Respond(
                $"🤖 SRMS AI Copilot ready. City has {hazards.Count} hazard reports with RDI of {rdi:F0}/100. " +
                "Ask me: 'Where are the worst potholes?', 'Summarize severe hazards', or 'Generate repair order'.",
                "GENERAL", []);
        }
    }

    private static AiChatResponse Respond(string message, string intent, List<Guid> relatedIds) =>
        new() { Message = message, Intent = intent, RelatedHazardIds = relatedIds, Timestamp = DateTime.UtcNow };

    // ─────────────────────────────────────────────────────────────────────────
    // Advisories
    // ─────────────────────────────────────────────────────────────────────────

    private static List<string> BuildAdvisories(List<HazardCluster> clusters, double rdi)
    {
        var ads = new List<string>();
        if (rdi >= 70) ads.Add("🔴 CRITICAL: City RDI exceeds 70 — immediate emergency response required.");
        else if (rdi >= 50) ads.Add("🟠 HIGH: City RDI in danger zone — prioritize high-severity clusters.");
        else if (rdi >= 30) ads.Add("🟡 MODERATE: Schedule preventive maintenance within 48 hours.");
        else ads.Add("🟢 LOW RISK: City road conditions are within acceptable parameters.");

        var largeCluster = clusters.FirstOrDefault(c => c.HazardCount >= 5);
        if (largeCluster != null)
            ads.Add($"⚠️ High-density cluster near ({largeCluster.CenterLat:F4}, {largeCluster.CenterLon:F4}) — {largeCluster.HazardCount} reports within 500m.");

        return ads;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Haversine distance (metres)
    // ─────────────────────────────────────────────────────────────────────────

    private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6_371_000;
        double dLat = ToRad(lat2 - lat1);
        double dLon = ToRad(lon2 - lon1);
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                 + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2))
                 * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

public class AiInsightsResult
{
    public double CityRoadDangerIndex { get; set; }
    public int TotalHazards { get; set; }
    public double VerifiedHazardsPercent { get; set; }
    public int TotalClusters { get; set; }
    public List<HazardCluster> Clusters { get; set; } = [];
    public List<string> TopRiskDescriptions { get; set; } = [];
    public List<string> DispatchAdvisories { get; set; } = [];
}

public class HazardCluster
{
    public Guid ClusterId { get; set; }
    public double CenterLat { get; set; }
    public double CenterLon { get; set; }
    public int HazardCount { get; set; }
    public double AverageSeverity { get; set; }
    public double AverageRdi { get; set; }
    public int VerifiedCount { get; set; }
    public string DominantHazardType { get; set; } = string.Empty;
}

public class AiChatResponse
{
    public string Message { get; set; } = string.Empty;
    public string Intent { get; set; } = string.Empty;
    public List<Guid> RelatedHazardIds { get; set; } = [];
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
