using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Dtos;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

public class CamerasController(SrmsDbContext db) : BaseApiController
{
    // GET /api/cameras/fault-reports?status=open|resolved|all — the web
    // side of the mobile Camera Status screen's "Report fault" button:
    // shows every fault an inspector has flagged, newest first. Defaults
    // to open reports, matching the proposals list's "pending by default"
    // convention.
    [HttpGet("fault-reports")]
    public async Task<ActionResult<ApiResponse<List<FaultReportDto>>>> GetFaultReports([FromQuery] string status = "open")
    {
        var query = db.SensorFaultReports
            .AsNoTracking()
            .Include(f => f.CameraSensor)
            .ThenInclude(c => c.Intersection)
            .AsQueryable();

        query = status.ToLowerInvariant() switch
        {
            "resolved" => query.Where(f => f.Status == "RESOLVED"),
            "all" => query,
            _ => query.Where(f => f.Status == "OPEN"),
        };

        var reports = await query
            .OrderByDescending(f => f.ReportedAt)
            .Select(f => new FaultReportDto(
                f.Id,
                f.CameraSensorId,
                f.CameraSensor.LaneLabel,
                f.CameraSensor.IntersectionId,
                f.CameraSensor.Intersection.Name,
                f.Description,
                f.Status,
                f.ReportedAt,
                f.ResolvedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<FaultReportDto>>.Ok(reports));
    }

    // POST /api/cameras/{cameraSensorId}/fault-reports — a traffic
    // inspector (mobile Camera Status screen) flagging a camera that looks
    // faulty (not reporting, feed frozen, etc.). Real JWT auth isn't built
    // yet, so this falls back to the seeded FieldOfficer account as a
    // stand-in reporter, same placeholder pattern ProposalsController uses
    // for TrafficControlStaff.
    [HttpPost("{cameraSensorId:guid}/fault-reports")]
    public async Task<ActionResult<ApiResponse<FaultReportDto>>> ReportFault(Guid cameraSensorId, CreateFaultReportRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(ApiResponse<FaultReportDto>.Fail("A description of the fault is required."));
        }

        var camera = await db.CameraSensors.Include(c => c.Intersection).FirstOrDefaultAsync(c => c.Id == cameraSensorId);
        if (camera is null)
        {
            return NotFound(ApiResponse<FaultReportDto>.Fail("Camera sensor not found."));
        }

        var reporter = await db.Users.FirstOrDefaultAsync(u => u.Role == "FieldOfficer");
        if (reporter is null)
        {
            return StatusCode(500, ApiResponse<FaultReportDto>.Fail("No FieldOfficer user found to record the report."));
        }

        var report = new SensorFaultReport
        {
            Id = Guid.NewGuid(),
            CameraSensorId = cameraSensorId,
            ReportedByUserId = reporter.Id,
            Description = request.Description.Trim(),
            Status = "OPEN",
            ReportedAt = DateTime.UtcNow,
        };
        db.SensorFaultReports.Add(report);
        await db.SaveChangesAsync();

        var dto = new FaultReportDto(
            report.Id, report.CameraSensorId, camera.LaneLabel, camera.IntersectionId, camera.Intersection.Name,
            report.Description, report.Status, report.ReportedAt, report.ResolvedAt);
        return Ok(ApiResponse<FaultReportDto>.Ok(dto, "Fault reported."));
    }

    // POST /api/cameras/fault-reports/{id}/resolve — lets a web operator
    // mark a reported fault as fixed, once someone's actually checked the
    // camera. Only meaningful action on this list beyond just reading it.
    [HttpPost("fault-reports/{id:guid}/resolve")]
    public async Task<ActionResult<ApiResponse<FaultReportDto>>> ResolveFaultReport(Guid id)
    {
        var report = await db.SensorFaultReports
            .Include(f => f.CameraSensor)
            .ThenInclude(c => c.Intersection)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (report is null)
        {
            return NotFound(ApiResponse<FaultReportDto>.Fail("Fault report not found."));
        }
        if (report.Status == "RESOLVED")
        {
            return BadRequest(ApiResponse<FaultReportDto>.Fail("This fault report is already resolved."));
        }

        report.Status = "RESOLVED";
        report.ResolvedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var dto = new FaultReportDto(
            report.Id, report.CameraSensorId, report.CameraSensor.LaneLabel, report.CameraSensor.IntersectionId,
            report.CameraSensor.Intersection.Name, report.Description, report.Status, report.ReportedAt, report.ResolvedAt);
        return Ok(ApiResponse<FaultReportDto>.Ok(dto, "Marked resolved."));
    }
}
