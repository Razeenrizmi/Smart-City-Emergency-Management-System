using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HazardsController : ControllerBase
{
    private readonly AppDbContext _context;

    public HazardsController(AppDbContext context)
    {
        _context = context;
    }

    // POST: api/hazards/report
    [HttpPost("report")]
    public async Task<IActionResult> CreateReport([FromBody] RoadHazardReport report)
    {
        // Severity calculation based on accelerometer spike
        if (report.AccelerometerZSpike >= 18.0m) report.SeverityScore = 5;
        else if (report.AccelerometerZSpike >= 14.0m) report.SeverityScore = 4;
        else if (report.AccelerometerZSpike >= 10.0m) report.SeverityScore = 3;
        else if (report.AccelerometerZSpike >= 7.0m) report.SeverityScore = 2;
        else report.SeverityScore = 1;

        _context.RoadHazardReports.Add(report);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Hazard logged successfully", id = report.HazardId });
    }

    // GET: api/hazards/all
    [HttpGet("all")]
    public async Task<IActionResult> GetAllHazards()
    {
        var hazards = await _context.RoadHazardReports
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync();

        return Ok(new { success = true, data = hazards });
    }
}