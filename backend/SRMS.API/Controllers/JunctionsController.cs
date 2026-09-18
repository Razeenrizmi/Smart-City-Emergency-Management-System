using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Dtos;

namespace SRMS.API.Controllers;

public class JunctionsController(SrmsDbContext db) : BaseApiController
{
    // GET /api/junctions — every junction plus its most recent camera
    // reading, for the React Junction Control Panel's real-time density view.
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<JunctionSummaryDto>>>> GetAll()
    {
        var junctions = await db.RoadJunctions.AsNoTracking().ToListAsync();
        var junctionIds = junctions.Select(j => j.Id).ToList();

        var latestByJunction = await db.JunctionCameraTelemetry
            .AsNoTracking()
            .Where(t => junctionIds.Contains(t.JunctionId))
            .GroupBy(t => t.JunctionId)
            .Select(g => g.OrderByDescending(t => t.RecordedAt).First())
            .ToDictionaryAsync(t => t.JunctionId);

        var result = junctions
            .Select(j =>
            {
                latestByJunction.TryGetValue(j.Id, out var latest);
                var latestDto = latest is null
                    ? null
                    : new LatestTelemetryDto(latest.DetectedVehicleCount, latest.CongestionLevel, latest.RecordedAt);
                return new JunctionSummaryDto(j.Id, j.JunctionName, j.Latitude, j.Longitude, j.CurrentSignalState, latestDto);
            })
            .ToList();

        return Ok(ApiResponse<List<JunctionSummaryDto>>.Ok(result));
    }

    // GET /api/junctions/{id}/telemetry?limit=20 — recent readings for one
    // junction, oldest to newest, for a small trend view.
    [HttpGet("{id:guid}/telemetry")]
    public async Task<ActionResult<ApiResponse<List<LatestTelemetryDto>>>> GetTelemetryHistory(Guid id, [FromQuery] int limit = 20)
    {
        var junctionExists = await db.RoadJunctions.AnyAsync(j => j.Id == id);
        if (!junctionExists)
        {
            return NotFound(ApiResponse<List<LatestTelemetryDto>>.Fail("Junction not found."));
        }

        var readings = await db.JunctionCameraTelemetry
            .AsNoTracking()
            .Where(t => t.JunctionId == id)
            .OrderByDescending(t => t.RecordedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .OrderBy(t => t.RecordedAt)
            .Select(t => new LatestTelemetryDto(t.DetectedVehicleCount, t.CongestionLevel, t.RecordedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<LatestTelemetryDto>>.Ok(readings));
    }
}
