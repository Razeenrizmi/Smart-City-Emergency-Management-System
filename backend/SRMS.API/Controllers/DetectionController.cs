using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/detection")]
public class DetectionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public DetectionController(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    /// <summary>
    /// Centralized detection tunables shared with the frontend
    /// (5 FPS sampling, confirmation frames, alert cooldown, thresholds).
    /// </summary>
    [HttpGet("config")]
    public ActionResult<ApiResponse<DetectionConfigResponse>> GetConfig()
    {
        var config = new DetectionConfigResponse
        {
            TargetAiFps = _configuration.GetValue("Detection:TargetAiFps", 5),
            FrameIntervalMs = _configuration.GetValue("Detection:FrameIntervalMs", 200),
            ConfidenceThreshold = _configuration.GetValue("Detection:ConfidenceThreshold", 0.6),
            IouThreshold = _configuration.GetValue("Detection:IouThreshold", 0.45),
            TrackingTimeoutSeconds = _configuration.GetValue("Detection:TrackingTimeoutSeconds", 3.0),
            ConfirmationFrames = _configuration.GetValue("Detection:ConfirmationFrames", 3),
            OcrConfidenceThreshold = _configuration.GetValue("Detection:OcrConfidenceThreshold", 0.3),
            OcrFallbackMinConf = _configuration.GetValue("Detection:OcrFallbackMinConf", 0.55),
            PlateVoteMin = _configuration.GetValue("Detection:PlateVoteMin", 2),
            AlertCooldownSeconds = _configuration.GetValue("Detection:AlertCooldownSeconds", 60)
        };
        if (config.TargetAiFps > 0)
            config.FrameIntervalMs = 1000 / config.TargetAiFps;
        return Ok(ApiResponse<DetectionConfigResponse>.Ok(config));
    }

    /// <summary>All detections produced by a specific CCTV node.</summary>
    [HttpGet("node/{nodeId:int}")]
    public async Task<ActionResult<ApiResponse<List<DetectionLog>>>> GetNodeDetections(int nodeId)
    {
        var logs = await _context.DetectionLogs
            .Where(d => d.NodeId == nodeId)
            .OrderByDescending(d => d.Timestamp)
            .ToListAsync();
        return Ok(ApiResponse<List<DetectionLog>>.Ok(logs));
    }

    /// <summary>
    /// Active (pending officer review) detections for a node — used for per-node alert counters.
    /// </summary>
    [HttpGet("node/{nodeId:int}/active")]
    public async Task<ActionResult<ApiResponse<List<DetectionLog>>>> GetNodeActiveDetections(int nodeId)
    {
        var logs = await _context.DetectionLogs
            .Where(d => d.NodeId == nodeId && d.Status == "REQUIRES_OFFICER_REVIEW")
            .OrderByDescending(d => d.Timestamp)
            .ToListAsync();
        return Ok(ApiResponse<List<DetectionLog>>.Ok(logs));
    }

    /// <summary>
    /// Detection history with optional filters:
    /// nodeId, plate, vehicleType, crimeMatch, status, from (yyyy-MM-dd), to (yyyy-MM-dd),
    /// limit, offset (pagination for mobile — omit limit to return all rows).
    /// </summary>
    [HttpGet("history")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<ApiResponse<List<DetectionLog>>>> GetHistory(
        [FromQuery] int? nodeId,
        [FromQuery] string? plate,
        [FromQuery] string? vehicleType,
        [FromQuery] bool? crimeMatch,
        [FromQuery] string? status,
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? limit,
        [FromQuery] int? offset)
    {
        var query = ApplyHistoryFilters(_context.DetectionLogs.AsQueryable(), nodeId, plate, vehicleType, crimeMatch, status, from, to);

        var total = await query.CountAsync();
        Response.Headers["X-Total-Count"] = total.ToString();

        var ordered = query.OrderByDescending(d => d.Timestamp);
        IEnumerable<DetectionLog> page = ordered;
        if (offset.HasValue && offset.Value > 0)
            page = page.Skip(offset.Value);
        if (limit.HasValue && limit.Value > 0)
            page = page.Take(limit.Value);

        var logs = page.ToList();
        return Ok(ApiResponse<List<DetectionLog>>.Ok(logs));
    }

    /// <summary>Shared history filter pipeline (web + mobile).</summary>
    internal static IQueryable<DetectionLog> ApplyHistoryFilters(
        IQueryable<DetectionLog> query,
        int? nodeId,
        string? plate,
        string? vehicleType,
        bool? crimeMatch,
        string? status,
        string? from,
        string? to)
    {
        if (nodeId.HasValue)
            query = query.Where(d => d.NodeId == nodeId.Value);

        if (!string.IsNullOrWhiteSpace(plate))
        {
            var p = plate.Trim();
            query = query.Where(d => d.PlateNumber.Contains(p));
        }

        if (!string.IsNullOrWhiteSpace(vehicleType))
            query = query.Where(d => d.VehicleType == vehicleType);

        if (crimeMatch.HasValue)
            query = query.Where(d => d.CrimeMatch == crimeMatch.Value);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(d => d.Status == status);

        if (!string.IsNullOrWhiteSpace(from))
        {
            var fromStr = from.Length == 10 ? from + " 00:00:00" : from;
            query = query.Where(d => string.Compare(d.Timestamp, fromStr) >= 0);
        }

        if (!string.IsNullOrWhiteSpace(to))
        {
            var toStr = to.Length == 10 ? to + " 23:59:59" : to;
            query = query.Where(d => string.Compare(d.Timestamp, toStr) <= 0);
        }

        return query;
    }

    /// <summary>
    /// Observation history for a plate across all CCTV nodes.
    /// Same plate seen by two nodes = two separate observations (never merged).
    /// </summary>
    [HttpGet("observations/{plate}")]
    public async Task<ActionResult<ApiResponse<List<DetectionLog>>>> GetPlateObservations(string plate)
    {
        var normalized = plate.Replace(" ", "").ToUpper();
        var logs = await _context.DetectionLogs
            .Where(d => d.PlateNumber.Replace(" ", "").ToUpper() == normalized)
            .OrderBy(d => d.Timestamp)
            .ToListAsync();
        return Ok(ApiResponse<List<DetectionLog>>.Ok(logs));
    }
}

public class DetectionConfigResponse
{
    public int TargetAiFps { get; set; } = 5;
    public int FrameIntervalMs { get; set; } = 200;
    public double ConfidenceThreshold { get; set; } = 0.6;
    public double IouThreshold { get; set; } = 0.45;
    public double TrackingTimeoutSeconds { get; set; } = 3.0;
    public int ConfirmationFrames { get; set; } = 3;
    public double OcrConfidenceThreshold { get; set; } = 0.3;
    public double OcrFallbackMinConf { get; set; } = 0.55;
    public int PlateVoteMin { get; set; } = 2;
    public double AlertCooldownSeconds { get; set; } = 60;
}
