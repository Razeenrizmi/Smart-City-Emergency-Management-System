using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Dtos;
using SRMS.API.Models;
using SRMS.API.Services.Agents;
using SRMS.API.Support;

namespace SRMS.API.Controllers;

public class IntersectionsController(SrmsDbContext db, SignalTimingAgentWorkflow agentWorkflow) : BaseApiController
{
    // GET /api/intersections — every intersection plus an aggregate of its
    // cameras' most recent readings, for the React Junction Control Panel's
    // real-time density view.
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<IntersectionSummaryDto>>>> GetAll()
    {
        var intersections = await db.Intersections.AsNoTracking().ToListAsync();

        // One "latest" reading per camera sensor, then aggregated per
        // intersection below — a sensor that hasn't reported yet simply
        // doesn't contribute.
        var latestPerSensor = await db.TelemetryReadings
            .AsNoTracking()
            .GroupBy(t => t.CameraSensorId)
            .Select(g => g.OrderByDescending(t => t.Timestamp).First())
            .ToListAsync();

        var byIntersection = latestPerSensor.ToLookup(r => r.IntersectionId);

        var result = intersections
            .Select(i =>
            {
                var readings = byIntersection[i.Id].ToList();
                if (readings.Count == 0)
                {
                    return new IntersectionSummaryDto(i.Id, i.Name, i.LaneCount, i.Latitude, i.Longitude, null, null, null, null);
                }

                var totalVehicles = readings.Sum(r => r.VehicleCount);
                var avgDensity = readings.Average(r => r.LaneDensityPercent);
                var congestionLevel = CongestionLevelCalculator.FromLaneDensityPercent(avgDensity);
                var lastUpdated = readings.Max(r => r.Timestamp);

                return new IntersectionSummaryDto(i.Id, i.Name, i.LaneCount, i.Latitude, i.Longitude, totalVehicles, avgDensity, congestionLevel, lastUpdated);
            })
            .ToList();

        return Ok(ApiResponse<List<IntersectionSummaryDto>>.Ok(result));
    }

    // GET /api/intersections/{id}/cameras — one row per camera sensor
    // (road) at this junction with its latest reading, for a per-road
    // breakdown view (e.g. the Flutter mobile app's live preview) instead
    // of just the junction-wide aggregate GetAll() returns.
    [HttpGet("{id:guid}/cameras")]
    public async Task<ActionResult<ApiResponse<List<CameraStatusDto>>>> GetCameras(Guid id)
    {
        var exists = await db.Intersections.AnyAsync(i => i.Id == id);
        if (!exists)
        {
            return NotFound(ApiResponse<List<CameraStatusDto>>.Fail("Intersection not found."));
        }

        var sensors = await db.CameraSensors.AsNoTracking().Where(c => c.IntersectionId == id).ToListAsync();

        var latestPerSensor = await db.TelemetryReadings
            .AsNoTracking()
            .Where(t => t.IntersectionId == id)
            .GroupBy(t => t.CameraSensorId)
            .Select(g => g.OrderByDescending(t => t.Timestamp).First())
            .ToListAsync();

        var latestBySensor = latestPerSensor.ToDictionary(r => r.CameraSensorId);

        var result = sensors
            .Select(s => latestBySensor.TryGetValue(s.Id, out var reading)
                ? new CameraStatusDto(
                    s.Id, s.LaneLabel, reading.VehicleCount, reading.LaneDensityPercent,
                    CongestionLevelCalculator.FromLaneDensityPercent(reading.LaneDensityPercent), reading.Timestamp)
                : new CameraStatusDto(s.Id, s.LaneLabel, null, null, null, null))
            .ToList();

        return Ok(ApiResponse<List<CameraStatusDto>>.Ok(result));
    }

    // DELETE /api/intersections/{id} — removes a junction and everything
    // that hangs off it. Several of those tables use ON DELETE RESTRICT
    // (not CASCADE) at the database level, so the dependents have to be
    // deleted explicitly, in dependency order, before the intersection
    // itself — otherwise Postgres rejects the delete with a FK violation.
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var exists = await db.Intersections.AnyAsync(i => i.Id == id);
        if (!exists)
        {
            return NotFound(ApiResponse<object>.Fail("Intersection not found."));
        }

        await using var tx = await db.Database.BeginTransactionAsync();

        var workflowRunIds = db.AgentWorkflowRuns.Where(r => r.IntersectionId == id).Select(r => r.Id);
        var proposalIds = db.SignalTimingProposals.Where(p => p.IntersectionId == id).Select(p => p.Id);
        var cameraSensorIds = db.CameraSensors.Where(c => c.IntersectionId == id).Select(c => c.Id);

        await db.AgentWorkflowSteps.Where(s => workflowRunIds.Contains(s.WorkflowRunId)).ExecuteDeleteAsync();
        await db.SignalTimingDecisions.Where(d => proposalIds.Contains(d.ProposalId)).ExecuteDeleteAsync();
        await db.SignalTimingProposals.Where(p => p.IntersectionId == id).ExecuteDeleteAsync();
        await db.AgentWorkflowRuns.Where(r => r.IntersectionId == id).ExecuteDeleteAsync();
        await db.SensorFaultReports.Where(f => cameraSensorIds.Contains(f.CameraSensorId)).ExecuteDeleteAsync();
        await db.TelemetryReadings.Where(t => t.IntersectionId == id).ExecuteDeleteAsync();
        await db.CameraSensors.Where(c => c.IntersectionId == id).ExecuteDeleteAsync();
        await db.Intersections.Where(i => i.Id == id).ExecuteDeleteAsync();

        await tx.CommitAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Intersection deleted."));
    }

    // POST /api/intersections/from-simulation — the Signal Test Simulator's
    // "Save" option. Turns its in-browser scan results into a real
    // Intersection (one CameraSensor per road, one TelemetryReading per
    // camera carrying the scanned count), so it shows up on this same
    // panel like any other junction instead of staying a local-only demo.
    [HttpPost("from-simulation")]
    public async Task<ActionResult<ApiResponse<IntersectionSummaryDto>>> SaveFromSimulation(SaveSimulationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(ApiResponse<IntersectionSummaryDto>.Fail("A junction name is required."));
        }
        if (request.Roads is null || request.Roads.Count == 0)
        {
            return BadRequest(ApiResponse<IntersectionSummaryDto>.Fail("At least one scanned road is required."));
        }

        var now = DateTime.UtcNow;
        var intersection = new Intersection
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Latitude = 0,
            Longitude = 0,
            LaneCount = request.Roads.Count,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Intersections.Add(intersection);

        var readings = new List<TelemetryReading>();
        foreach (var road in request.Roads)
        {
            var sensor = new CameraSensor
            {
                Id = Guid.NewGuid(),
                IntersectionId = intersection.Id,
                LaneLabel = string.IsNullOrWhiteSpace(road.Name) ? "Unnamed road" : road.Name.Trim(),
                Status = "ACTIVE",
                InstalledAt = now,
            };
            db.CameraSensors.Add(sensor);

            // No real lane-capacity data from a simulated clip, so density
            // is a rough visual estimate from the scanned count — good
            // enough for the congestion badge, not a precise measurement.
            var laneDensityPercent = Math.Clamp(road.VehicleCount * 2.5, 0, 100);
            readings.Add(new TelemetryReading
            {
                Id = Guid.NewGuid(),
                CameraSensorId = sensor.Id,
                IntersectionId = intersection.Id,
                Timestamp = now,
                VehicleCount = road.VehicleCount,
                QueueLength = 0,
                LaneDensityPercent = laneDensityPercent,
            });
        }

        db.TelemetryReadings.AddRange(readings);
        await db.SaveChangesAsync();

        var avgDensity = readings.Average(r => r.LaneDensityPercent);
        var dto = new IntersectionSummaryDto(
            intersection.Id,
            intersection.Name,
            intersection.LaneCount,
            intersection.Latitude,
            intersection.Longitude,
            readings.Sum(r => r.VehicleCount),
            avgDensity,
            CongestionLevelCalculator.FromLaneDensityPercent(avgDensity),
            now);

        return Ok(ApiResponse<IntersectionSummaryDto>.Ok(dto, "Simulation saved as a junction."));
    }

    // POST /api/intersections/{id}/update-from-simulation — refreshes an
    // existing junction's telemetry (e.g. new manually-entered vehicle
    // counts). Adds a fresh TelemetryReading per road (matched to its
    // CameraSensor by name — a rename creates a new sensor rather than
    // relabeling the old one, a deliberate simplification). Does NOT
    // create a proposal itself — call POST /{id}/analyze afterward to get
    // a real, per-road AI-generated proposal instead of a rule-based one.
    [HttpPost("{id:guid}/update-from-simulation")]
    public async Task<ActionResult<ApiResponse<IntersectionSummaryDto>>> UpdateFromSimulation(Guid id, UpdateSimulationRequest request)
    {
        var intersection = await db.Intersections.FirstOrDefaultAsync(i => i.Id == id);
        if (intersection is null)
        {
            return NotFound(ApiResponse<IntersectionSummaryDto>.Fail("Intersection not found."));
        }
        if (request.Roads is null || request.Roads.Count == 0)
        {
            return BadRequest(ApiResponse<IntersectionSummaryDto>.Fail("At least one scanned road is required."));
        }

        var now = DateTime.UtcNow;
        var existingSensors = await db.CameraSensors.Where(c => c.IntersectionId == id).ToListAsync();
        var sensorByLabel = existingSensors.ToDictionary(s => s.LaneLabel, s => s);

        var readings = new List<TelemetryReading>();
        foreach (var road in request.Roads)
        {
            var label = string.IsNullOrWhiteSpace(road.Name) ? "Unnamed road" : road.Name.Trim();
            if (!sensorByLabel.TryGetValue(label, out var sensor))
            {
                sensor = new CameraSensor
                {
                    Id = Guid.NewGuid(),
                    IntersectionId = id,
                    LaneLabel = label,
                    Status = "ACTIVE",
                    InstalledAt = now,
                };
                db.CameraSensors.Add(sensor);
                sensorByLabel[label] = sensor;
            }

            var laneDensityPercent = Math.Clamp(road.VehicleCount * 2.5, 0, 100);
            readings.Add(new TelemetryReading
            {
                Id = Guid.NewGuid(),
                CameraSensorId = sensor.Id,
                IntersectionId = id,
                Timestamp = now,
                VehicleCount = road.VehicleCount,
                QueueLength = 0,
                LaneDensityPercent = laneDensityPercent,
            });
        }

        db.TelemetryReadings.AddRange(readings);
        intersection.UpdatedAt = now;
        await db.SaveChangesAsync();

        var avgDensity = readings.Average(r => r.LaneDensityPercent);
        var dto = new IntersectionSummaryDto(
            intersection.Id,
            intersection.Name,
            intersection.LaneCount,
            intersection.Latitude,
            intersection.Longitude,
            readings.Sum(r => r.VehicleCount),
            avgDensity,
            CongestionLevelCalculator.FromLaneDensityPercent(avgDensity),
            now);

        return Ok(ApiResponse<IntersectionSummaryDto>.Ok(dto, "Junction updated from simulation."));
    }

    // POST /api/intersections/{id}/analyze — runs your Agentic AI workflow
    // for this junction right now. This is the ONLY way a proposal gets
    // created — the background telemetry service just records readings,
    // it never triggers the agent on its own — so every proposal in the
    // system traces back to an explicit operator action (the web app's
    // "Get AI signal timing plan" button calls this endpoint).
    [HttpPost("{id:guid}/analyze")]
    public async Task<ActionResult<ApiResponse<object>>> Analyze(Guid id)
    {
        var intersection = await db.Intersections
            .Include(i => i.CameraSensors)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (intersection is null)
        {
            return NotFound(ApiResponse<object>.Fail("Intersection not found."));
        }
        if (intersection.CameraSensors.Count == 0)
        {
            return BadRequest(ApiResponse<object>.Fail("This junction has no camera sensors yet — nothing for the agent to analyze."));
        }

        var succeeded = await agentWorkflow.RunAsync(intersection);

        var run = await db.AgentWorkflowRuns
            .Where(r => r.IntersectionId == id)
            .OrderByDescending(r => r.StartedAt)
            .FirstAsync();

        var steps = await db.AgentWorkflowSteps
            .Where(s => s.WorkflowRunId == run.Id)
            .OrderBy(s => s.StepIndex)
            .Select(s => new { s.AgentName, s.StepIndex, s.ValidationResult, s.DurationMs })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(
            new { run.Id, run.Status, run.ErrorMessage, steps },
            succeeded ? "Agent workflow completed — a proposal is awaiting approval." : "Agent workflow finished without producing a proposal."));
    }
}
