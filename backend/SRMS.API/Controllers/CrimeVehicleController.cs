using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/crime-vehicle")]
public class CrimeVehicleController : ControllerBase
{
    private readonly AppDbContext _context;
    private static readonly string[] SamplePlates = { "WP CAD-7829", "SP BC-4410", "WP GZ-9901", "CP KY-1290", "CB-8821", "KAP-3091" };
    private static readonly Random _rand = new();

    public CrimeVehicleController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("scan")]
    public async Task<ActionResult<ApiResponse<ScanResultResponse>>> ScanImage(IFormFile image)
    {
        if (image == null || image.Length == 0)
            return BadRequest(ApiResponse<ScanResultResponse>.Fail("No image uploaded"));

        // Simulate plate detection - in production, use OCR/AI service
        await Task.Delay(500); // simulate processing time

        var detectedPlate = SamplePlates[_rand.Next(SamplePlates.Length)];
        var confidence = Math.Round(94.0 + _rand.NextDouble() * 5.5, 1);
        var hotlist = await _context.HotlistVehicles.ToListAsync();
        var matched = hotlist.FirstOrDefault(h =>
            h.PlateNumber.Replace(" ", "").Equals(detectedPlate.Replace(" ", ""), StringComparison.OrdinalIgnoreCase));

        var response = new ScanResultResponse
        {
            DetectedPlate = detectedPlate,
            Confidence = confidence,
            VehicleInfo = matched != null ? $"{matched.MakeModel} ({matched.Color})" : "Unidentified Vehicle",
            IsMatch = matched != null,
            MatchedVehicle = matched != null ? new HotlistMatchResponse
            {
                PlateNumber = matched.PlateNumber,
                MakeModel = matched.MakeModel,
                Color = matched.Color,
                ThreatLevel = matched.ThreatLevel,
                IncidentType = matched.IncidentType,
                Status = matched.Status,
                Notes = matched.Notes
            } : null,
            ScannedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        };

        // Log the detection
        var nextLogId = await _context.DetectionLogs.AnyAsync()
            ? await _context.DetectionLogs.MaxAsync(d => d.Id) + 1
            : 1;

        _context.DetectionLogs.Add(new DetectionLog
        {
            Id = nextLogId,
            LogId = $"LOG-{10000 + _rand.Next(90000)}",
            Timestamp = response.ScannedAt,
            PlateNumber = detectedPlate,
            CameraId = "MOBILE-SCAN",
            CameraName = "Mobile ANPR Scanner",
            Location = "Field Device",
            Confidence = confidence,
            Speed = "N/A",
            Direction = "N/A",
            IsHotlistMatch = matched != null,
            ThreatLevel = matched?.ThreatLevel ?? "CLEAR",
            VehicleDetails = response.VehicleInfo,
            Status = matched != null ? "ALERT_TRIGGERED" : "CLEARED",
            Snapshot = ""
        });

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<ScanResultResponse>.Ok(response, matched != null ? "Hotlist match detected" : "Vehicle clear"));
    }

    [HttpGet("cameras")]
    public async Task<ActionResult<ApiResponse<List<Camera>>>> GetCameras()
    {
        var cameras = await _context.Cameras.ToListAsync();
        return Ok(ApiResponse<List<Camera>>.Ok(cameras));
    }

    [HttpGet("cameras/{cameraId}")]
    public async Task<ActionResult<ApiResponse<Camera>>> GetCamera(string cameraId)
    {
        var camera = await _context.Cameras.FirstOrDefaultAsync(c => c.CameraId == cameraId);
        if (camera == null)
            return NotFound(ApiResponse<Camera>.Fail("Camera not found"));
        return Ok(ApiResponse<Camera>.Ok(camera));
    }

    [HttpGet("hotlist")]
    public async Task<ActionResult<ApiResponse<List<HotlistVehicle>>>> GetHotlist()
    {
        var hotlist = await _context.HotlistVehicles.ToListAsync();
        return Ok(ApiResponse<List<HotlistVehicle>>.Ok(hotlist));
    }

    [HttpGet("hotlist/{vehicleId}")]
    public async Task<ActionResult<ApiResponse<HotlistVehicle>>> GetHotlistVehicle(string vehicleId)
    {
        var vehicle = await _context.HotlistVehicles.FirstOrDefaultAsync(h => h.VehicleId == vehicleId);
        if (vehicle == null)
            return NotFound(ApiResponse<HotlistVehicle>.Fail("Vehicle not found in hotlist"));
        return Ok(ApiResponse<HotlistVehicle>.Ok(vehicle));
    }

    [HttpPost("hotlist")]
    public async Task<ActionResult<ApiResponse<HotlistVehicle>>> AddHotlistVehicle([FromBody] HotlistVehicle vehicle)
    {
        var nextId = await _context.HotlistVehicles.AnyAsync()
            ? await _context.HotlistVehicles.MaxAsync(h => h.Id) + 1
            : 1;

        vehicle.Id = nextId;
        var ticks = DateTime.Now.Ticks.ToString();
        vehicle.VehicleId = $"HV-{ticks.Substring(ticks.Length - 4)}";

        _context.HotlistVehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHotlistVehicle), new { vehicleId = vehicle.VehicleId },
            ApiResponse<HotlistVehicle>.Ok(vehicle, "Vehicle added to hotlist"));
    }

    [HttpPut("hotlist/{vehicleId}/status")]
    public async Task<ActionResult<ApiResponse<HotlistVehicle>>> UpdateHotlistStatus(string vehicleId, [FromBody] StatusUpdateRequest request)
    {
        var vehicle = await _context.HotlistVehicles.FirstOrDefaultAsync(h => h.VehicleId == vehicleId);
        if (vehicle == null)
            return NotFound(ApiResponse<HotlistVehicle>.Fail("Vehicle not found in hotlist"));

        vehicle.Status = request.Status;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<HotlistVehicle>.Ok(vehicle, "Status updated"));
    }

    [HttpDelete("hotlist/{vehicleId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveFromHotlist(string vehicleId)
    {
        var vehicle = await _context.HotlistVehicles.FirstOrDefaultAsync(h => h.VehicleId == vehicleId);
        if (vehicle == null)
            return NotFound(ApiResponse<bool>.Fail("Vehicle not found in hotlist"));

        _context.HotlistVehicles.Remove(vehicle);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Vehicle removed from hotlist"));
    }

    [HttpGet("logs")]
    public async Task<ActionResult<ApiResponse<List<DetectionLog>>>> GetDetectionLogs()
    {
        var logs = await _context.DetectionLogs.OrderByDescending(d => d.Timestamp).ToListAsync();
        return Ok(ApiResponse<List<DetectionLog>>.Ok(logs));
    }

    [HttpGet("logs/{logId}")]
    public async Task<ActionResult<ApiResponse<DetectionLog>>> GetDetectionLog(string logId)
    {
        var log = await _context.DetectionLogs.FirstOrDefaultAsync(d => d.LogId == logId);
        if (log == null)
            return NotFound(ApiResponse<DetectionLog>.Fail("Log not found"));
        return Ok(ApiResponse<DetectionLog>.Ok(log));
    }

    [HttpPost("logs")]
    public async Task<ActionResult<ApiResponse<DetectionLog>>> AddDetectionLog([FromBody] DetectionLog logEntry)
    {
        var nextId = await _context.DetectionLogs.AnyAsync()
            ? await _context.DetectionLogs.MaxAsync(d => d.Id) + 1
            : 1;

        logEntry.Id = nextId;
        logEntry.LogId = $"LOG-{10000 + Random.Shared.Next(90000)}";

        _context.DetectionLogs.Add(logEntry);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDetectionLog), new { logId = logEntry.LogId },
            ApiResponse<DetectionLog>.Ok(logEntry, "Detection log created"));
    }

    [HttpGet("patrols")]
    public async Task<ActionResult<ApiResponse<List<PatrolUnit>>>> GetPatrolUnits()
    {
        var patrols = await _context.PatrolUnits.ToListAsync();
        return Ok(ApiResponse<List<PatrolUnit>>.Ok(patrols));
    }

    [HttpGet("patrols/{unitId}")]
    public async Task<ActionResult<ApiResponse<PatrolUnit>>> GetPatrolUnit(string unitId)
    {
        var unit = await _context.PatrolUnits.FirstOrDefaultAsync(p => p.UnitId == unitId);
        if (unit == null)
            return NotFound(ApiResponse<PatrolUnit>.Fail("Patrol unit not found"));
        return Ok(ApiResponse<PatrolUnit>.Ok(unit));
    }

    [HttpPost("dispatch")]
    public async Task<ActionResult<ApiResponse<DispatchResult>>> DispatchPatrol([FromBody] DispatchRequest request)
    {
        var unit = await _context.PatrolUnits.FirstOrDefaultAsync(p => p.UnitId == request.UnitId);
        if (unit == null)
            return NotFound(ApiResponse<DispatchResult>.Fail("Patrol unit not found"));

        var log = await _context.DetectionLogs.FirstOrDefaultAsync(d => d.LogId == request.LogId);
        if (log == null)
            return NotFound(ApiResponse<DispatchResult>.Fail("Detection log not found"));

        unit.Status = "EN_ROUTE";
        unit.Eta = "3 mins";
        log.Status = "DISPATCHED";

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<DispatchResult>.Ok(new DispatchResult
        {
            Success = true,
            UnitId = request.UnitId,
            LogId = request.LogId,
            Message = $"Unit {unit.Callsign} dispatched to incident {request.LogId}"
        }, "Patrol unit dispatched"));
    }
}

public class StatusUpdateRequest
{
    public string Status { get; set; } = string.Empty;
}

public class DispatchRequest
{
    public string UnitId { get; set; } = string.Empty;
    public string LogId { get; set; } = string.Empty;
}

public class DispatchResult
{
    public bool Success { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string LogId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class ScanResultResponse
{
    public string DetectedPlate { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string VehicleInfo { get; set; } = string.Empty;
    public bool IsMatch { get; set; }
    public HotlistMatchResponse? MatchedVehicle { get; set; }
    public string ScannedAt { get; set; } = string.Empty;
}

public class HotlistMatchResponse
{
    public string PlateNumber { get; set; } = string.Empty;
    public string MakeModel { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string ThreatLevel { get; set; } = string.Empty;
    public string IncidentType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}
