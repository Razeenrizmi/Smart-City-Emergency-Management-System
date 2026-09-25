using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

/// <summary>
/// Aggregate statistics for the web + Flutter dashboards.
/// All numbers come from the existing PostgreSQL tables (no hard-coded values).
/// </summary>
[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public DashboardController(AppDbContext context, IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Dashboard rollup: node counts, alerts, detections, active tracks, AI FPS (target + measured).
    /// </summary>
    [HttpGet("statistics")]
    public async Task<ActionResult<ApiResponse<DashboardStatisticsResponse>>> GetStatistics()
    {
        var nodes = await _context.CctvNodes.AsNoTracking().ToListAsync();
        var todayPrefix = DateTime.Now.ToString("yyyy-MM-dd");
        var recentCutoff = DateTime.Now.AddMinutes(-5).ToString("yyyy-MM-dd HH:mm:ss");

        var allLogs = await _context.DetectionLogs.AsNoTracking().ToListAsync();

        var activeAlerts = allLogs.Count(l => l.Status == "REQUIRES_OFFICER_REVIEW");
        var todayLogs = allLogs.Where(l => l.Timestamp.StartsWith(todayPrefix)).ToList();
        var todayAlerts = todayLogs.Count(l => l.Status == "REQUIRES_OFFICER_REVIEW" || l.CrimeMatch);
        var crimeVehicles = allLogs.Count(l => l.CrimeMatch || l.IsHotlistMatch);
        var activeSessions = await _context.DetectionSessions.CountAsync(s => s.Status == "ACTIVE");

        // Active vehicle tracks = unique backend TrackIds seen in the last 5 minutes.
        var activeTracks = allLogs
            .Where(l => string.Compare(l.Timestamp, recentCutoff) >= 0 && l.TrackId.HasValue)
            .Select(l => (l.NodeId, l.TrackId!.Value))
            .Distinct()
            .Count();

        var vehiclesToday = todayLogs
            .Where(l => !string.IsNullOrWhiteSpace(l.PlateNumber) || l.TrackId.HasValue)
            .Select(l => (l.NodeId, l.SessionId, l.TrackId ?? -l.Id))
            .Distinct()
            .Count();

        var targetAiFps = _configuration.GetValue("Detection:TargetAiFps", 5);
        double? measuredAiFps = null;
        var aiReachable = false;

        try
        {
            var client = _httpClientFactory.CreateClient("AIService");
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            var aiStats = await client.GetFromJsonAsync<System.Text.Json.JsonElement>("/stats", cts.Token);
            aiReachable = true;
            if (aiStats.TryGetProperty("measuredAiFps", out var fpsEl) && fpsEl.ValueKind == System.Text.Json.JsonValueKind.Number)
                measuredAiFps = fpsEl.GetDouble();
        }
        catch
        {
            // AI service offline — measuredAiFps stays null (never faked).
        }

        var stats = new DashboardStatisticsResponse
        {
            TotalCctvNodes = nodes.Count,
            OnlineNodes = nodes.Count(n => n.Status == "ONLINE"),
            OfflineNodes = nodes.Count(n => n.Status == "OFFLINE"),
            ActiveAlerts = activeAlerts,
            TodayAlerts = todayAlerts,
            TotalDetections = allLogs.Count,
            DetectionsToday = todayLogs.Count,
            CrimeVehicles = crimeVehicles,
            ActiveSessions = activeSessions,
            ActiveTracks = activeTracks,
            VehiclesToday = vehiclesToday,
            TargetAiFps = targetAiFps,
            MeasuredAiFps = measuredAiFps,
            AiServiceOnline = aiReachable,
            GeneratedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        };

        return Ok(ApiResponse<DashboardStatisticsResponse>.Ok(stats));
    }
}

public class DashboardStatisticsResponse
{
    public int TotalCctvNodes { get; set; }
    public int OnlineNodes { get; set; }
    public int OfflineNodes { get; set; }
    public int ActiveAlerts { get; set; }
    public int TodayAlerts { get; set; }
    public int TotalDetections { get; set; }
    public int DetectionsToday { get; set; }
    public int CrimeVehicles { get; set; }
    public int ActiveSessions { get; set; }
    public int ActiveTracks { get; set; }
    public int VehiclesToday { get; set; }
    public int TargetAiFps { get; set; }
    /// <summary>Measured AI FPS from the AI service. null = AI unreachable (never faked).</summary>
    public double? MeasuredAiFps { get; set; }
    public bool AiServiceOnline { get; set; }
    public string GeneratedAt { get; set; } = string.Empty;
}
