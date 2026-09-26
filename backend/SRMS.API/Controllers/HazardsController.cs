using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HazardsController : ControllerBase
{
    private const string OfficerRole = "MUNICIPAL_OFFICER";

    private readonly AppDbContext _context;

    public HazardsController(AppDbContext context)
    {
        _context = context;
    }

    // POST: api/hazards/report  (public — reported from the mobile app)
    [HttpPost("report")]
    public async Task<IActionResult> CreateReport([FromBody] RoadHazardReport report)
    {
        // Severity calculation based on accelerometer spike
        if (report.AccelerometerZSpike >= 18.0m) report.SeverityScore = 5;
        else if (report.AccelerometerZSpike >= 14.0m) report.SeverityScore = 4;
        else if (report.AccelerometerZSpike >= 10.0m) report.SeverityScore = 3;
        else if (report.AccelerometerZSpike >= 7.0m) report.SeverityScore = 2;
        else report.SeverityScore = 1;

        // Reports always enter the officer approval queue.
        report.ApprovalStatus = "PENDING";
        report.IsVerified = false;

        _context.RoadHazardReports.Add(report);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Hazard logged successfully", id = report.HazardId });
    }

    // GET: api/hazards/all  (public — powers the live map)
    [HttpGet("all")]
    public async Task<IActionResult> GetAllHazards()
    {
        var hazards = await _context.RoadHazardReports
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync();

        return Ok(new { success = true, data = hazards });
    }

    // GET: api/hazards/pending  (officer verification queue)
    [HttpGet("pending")]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> GetPendingHazards()
    {
        var hazards = await _context.RoadHazardReports
            .Where(h => h.ApprovalStatus == "PENDING")
            .OrderByDescending(h => h.SeverityScore)
            .ThenByDescending(h => h.CreatedAt)
            .ToListAsync();

        return Ok(new { success = true, data = hazards });
    }

    // PUT: api/hazards/{id}/approve  (officer only)
    [HttpPut("{id:guid}/approve")]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var hazard = await _context.RoadHazardReports.FindAsync(id);
        if (hazard == null)
            return NotFound(new { success = false, error = "Hazard report not found." });

        hazard.ApprovalStatus = "APPROVED";
        hazard.IsVerified = true;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Hazard approved.", data = hazard });
    }

    // PUT: api/hazards/{id}/reject  (officer only)
    [HttpPut("{id:guid}/reject")]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> Reject(Guid id)
    {
        var hazard = await _context.RoadHazardReports.FindAsync(id);
        if (hazard == null)
            return NotFound(new { success = false, error = "Hazard report not found." });

        hazard.ApprovalStatus = "REJECTED";
        hazard.IsVerified = false;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Hazard rejected.", data = hazard });
    }
}
