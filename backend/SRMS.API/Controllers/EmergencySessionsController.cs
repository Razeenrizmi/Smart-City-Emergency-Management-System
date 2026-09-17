using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/emergencies")]
public class EmergencySessionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public EmergencySessionsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // POST /api/emergencies
    [HttpPost]
    public async Task<ActionResult<EmergencySessionResponse>> CreateEmergencySession([FromBody] CreateEmergencySessionRequest request)
    {
        // Validate driver_id is not empty
        if (request.DriverId == Guid.Empty)
        {
            return BadRequest("Driver ID cannot be empty.");
        }

        // Validate vehicle_type is not empty or whitespace
        if (string.IsNullOrWhiteSpace(request.VehicleType))
        {
            return BadRequest("Vehicle type cannot be empty.");
        }

        // Validate selected_route_id exists if provided
        if (request.SelectedRouteId.HasValue)
        {
            if (request.SelectedRouteId.Value == Guid.Empty)
            {
                return BadRequest("Selected route ID cannot be empty.");
            }

            var routeExists = await _context.Routes.AnyAsync(r => r.RouteId == request.SelectedRouteId.Value);
            if (!routeExists)
            {
                return BadRequest("Selected route does not exist.");
            }
        }

        var session = new EmergencySession
        {
            DriverId = request.DriverId,
            VehicleType = request.VehicleType,
            Status = "ACTIVE",
            SelectedRouteId = request.SelectedRouteId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.EmergencySessions.Add(session);
        await _context.SaveChangesAsync();

        var response = new EmergencySessionResponse
        {
            SessionId = session.SessionId,
            DriverId = session.DriverId,
            VehicleType = session.VehicleType,
            Status = session.Status,
            SelectedRouteId = session.SelectedRouteId,
            CreatedAt = session.CreatedAt,
            UpdatedAt = session.UpdatedAt
        };

        return CreatedAtAction(nameof(GetEmergencySession), new { id = session.SessionId }, response);
    }

    // GET /api/emergencies
    [HttpGet]
    public async Task<ActionResult<IEnumerable<EmergencySessionResponse>>> GetEmergencySessions()
    {
        var sessions = await _context.EmergencySessions
            .Select(s => new EmergencySessionResponse
            {
                SessionId = s.SessionId,
                DriverId = s.DriverId,
                VehicleType = s.VehicleType,
                Status = s.Status,
                SelectedRouteId = s.SelectedRouteId,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            })
            .ToListAsync();

        return Ok(sessions);
    }

    // GET /api/emergencies/active
    [HttpGet("active")]
    public async Task<ActionResult<IEnumerable<EmergencySessionResponse>>> GetActiveEmergencySessions()
    {
        var activeSessions = await _context.EmergencySessions
            .Where(s => s.Status == "ACTIVE")
            .Select(s => new EmergencySessionResponse
            {
                SessionId = s.SessionId,
                DriverId = s.DriverId,
                VehicleType = s.VehicleType,
                Status = s.Status,
                SelectedRouteId = s.SelectedRouteId,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            })
            .ToListAsync();

        return Ok(activeSessions);
    }

    // GET /api/emergencies/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<EmergencySessionResponse>> GetEmergencySession(Guid id)
    {
        var session = await _context.EmergencySessions
            .Where(s => s.SessionId == id)
            .Select(s => new EmergencySessionResponse
            {
                SessionId = s.SessionId,
                DriverId = s.DriverId,
                VehicleType = s.VehicleType,
                Status = s.Status,
                SelectedRouteId = s.SelectedRouteId,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (session == null)
        {
            return NotFound();
        }

        return Ok(session);
    }

    // POST /api/emergencies/{id}/complete
    [HttpPost("{id}/complete")]
    public async Task<ActionResult<EmergencySessionResponse>> CompleteEmergencySession(Guid id)
    {
        var session = await _context.EmergencySessions.FindAsync(id);

        if (session == null)
        {
            return NotFound();
        }

        session.Status = "COMPLETED";
        session.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var response = new EmergencySessionResponse
        {
            SessionId = session.SessionId,
            DriverId = session.DriverId,
            VehicleType = session.VehicleType,
            Status = session.Status,
            SelectedRouteId = session.SelectedRouteId,
            CreatedAt = session.CreatedAt,
            UpdatedAt = session.UpdatedAt
        };

        return Ok(response);
    }

    // POST /api/emergencies/{id}/cancel
    [HttpPost("{id}/cancel")]
    public async Task<ActionResult<EmergencySessionResponse>> CancelEmergencySession(Guid id)
    {
        var session = await _context.EmergencySessions.FindAsync(id);

        if (session == null)
        {
            return NotFound();
        }

        session.Status = "CANCELLED";
        session.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var response = new EmergencySessionResponse
        {
            SessionId = session.SessionId,
            DriverId = session.DriverId,
            VehicleType = session.VehicleType,
            Status = session.Status,
            SelectedRouteId = session.SelectedRouteId,
            CreatedAt = session.CreatedAt,
            UpdatedAt = session.UpdatedAt
        };

        return Ok(response);
    }
}
