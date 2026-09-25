using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;
using SRMS.API.Services;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/emergencies")]
public class EmergencySessionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly SignalActionProposalService _signalActionProposalService;
    private readonly ILogger<EmergencySessionsController> _logger;

    public EmergencySessionsController(
        ApplicationDbContext context,
        SignalActionProposalService signalActionProposalService,
        ILogger<EmergencySessionsController> logger)
    {
        _context = context;
        _signalActionProposalService = signalActionProposalService;
        _logger = logger;
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
    public async Task<ActionResult<EmergencyCompletionResponse>> CompleteEmergencySession(Guid id)
    {
        var session = await _context.EmergencySessions.FindAsync(id);

        if (session == null)
        {
            return NotFound("Emergency session not found.");
        }

        // Validate session is not already completed or cancelled
        if (session.Status == "COMPLETED")
        {
            return BadRequest("Emergency session is already COMPLETED.");
        }

        if (session.Status == "CANCELLED")
        {
            return BadRequest("Emergency session is CANCELLED. Cannot complete a cancelled session.");
        }

        // Use transaction for atomicity
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Find active preemption logs for this session
            var activeLogs = await _context.SignalPreemptionLogs
                .Include(spl => spl.RoadJunction)
                .Where(spl => spl.SessionId == id && spl.IsActive)
                .ToListAsync();

            var restoredJunctions = new List<RestoredJunctionInfo>();
            bool greenWaveRestored = false;

            // Restore signal states for each active preemption
            foreach (var log in activeLogs)
            {
                // Validate PreviousSignalState exists
                if (string.IsNullOrEmpty(log.PreviousSignalState))
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, "Cannot restore signal state: PreviousSignalState is missing in preemption log. Transaction rolled back.");
                }

                var junction = log.RoadJunction;
                if (junction != null)
                {
                    // Restore to previous state
                    junction.CurrentSignalState = log.PreviousSignalState;
                    junction.UpdatedAt = DateTime.UtcNow;

                    // Mark log as inactive
                    log.IsActive = false;
                    log.DeactivatedAt = DateTime.UtcNow;

                    restoredJunctions.Add(new RestoredJunctionInfo
                    {
                        JunctionId = junction.JunctionId,
                        JunctionName = junction.JunctionName,
                        RestoredSignalState = log.PreviousSignalState
                    });
                }
            }

            if (activeLogs.Any())
            {
                greenWaveRestored = true;
            }

            // Mark session as completed
            session.Status = "COMPLETED";
            session.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var response = new EmergencyCompletionResponse
            {
                SessionId = session.SessionId,
                Status = session.Status,
                GreenWaveRestored = greenWaveRestored,
                RestoredJunctions = restoredJunctions
            };

            return Ok(response);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, "An error occurred during emergency completion. Changes were rolled back.");
        }
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

    // POST /api/emergencies/{id}/activate-green-wave
    [HttpPost("{id}/activate-green-wave")]
    public async Task<ActionResult<GreenWaveActivationResponse>> ActivateGreenWave(Guid id)
    {
        var session = await _context.EmergencySessions
            .Include(s => s.SelectedRoute)
            .ThenInclude(r => r!.RouteJunctions)
            .ThenInclude(rj => rj.RoadJunction)
            .FirstOrDefaultAsync(s => s.SessionId == id);

        if (session == null)
        {
            return NotFound("Emergency session not found.");
        }

        // Validate session is ACTIVE
        if (session.Status != "ACTIVE")
        {
            return BadRequest("Emergency session is not ACTIVE. Cannot activate Green Wave.");
        }

        // Validate session has a selected route
        if (session.SelectedRouteId == null || session.SelectedRoute == null)
        {
            return BadRequest("Emergency session has no selected route. Cannot activate Green Wave.");
        }

        // Validate route exists
        var route = session.SelectedRoute;
        if (route == null)
        {
            return NotFound("Selected route not found.");
        }

        // Validate route has junctions
        if (route.RouteJunctions == null || !route.RouteJunctions.Any())
        {
            return BadRequest("Selected route has no junctions. Cannot activate Green Wave.");
        }

        // Check for duplicate activation - session already has active preemption logs
        var hasActiveLogs = await _context.SignalPreemptionLogs
            .AnyAsync(spl => spl.SessionId == id && spl.IsActive);

        if (hasActiveLogs)
        {
            return BadRequest("Green Wave is already active for this emergency session.");
        }

        var activationBlock = await _signalActionProposalService.GetGreenWaveActivationBlockReasonAsync(
            id,
            route.RouteJunctions.Select(rj => rj.JunctionId),
            HttpContext.RequestAborted);

        if (activationBlock != null)
        {
            return BadRequest(activationBlock);
        }

        // Use transaction for atomicity
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var activatedJunctions = new List<ActivatedJunctionInfo>();

            // Process junctions in sequence order
            foreach (var routeJunction in route.RouteJunctions.OrderBy(rj => rj.SequenceNumber))
            {
                var junction = routeJunction.RoadJunction;
                var previousState = junction.CurrentSignalState;

                // Save previous state and change to GREEN
                junction.CurrentSignalState = "GREEN";
                junction.UpdatedAt = DateTime.UtcNow;

                // Create preemption log
                var preemptionLog = new SignalPreemptionLog
                {
                    SessionId = session.SessionId,
                    JunctionId = junction.JunctionId,
                    IsActive = true,
                    ActivatedAt = DateTime.UtcNow,
                    PreviousSignalState = previousState
                };

                _context.SignalPreemptionLogs.Add(preemptionLog);

                activatedJunctions.Add(new ActivatedJunctionInfo
                {
                    JunctionId = junction.JunctionId,
                    JunctionName = junction.JunctionName,
                    SequenceNumber = routeJunction.SequenceNumber,
                    SignalState = junction.CurrentSignalState
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var response = new GreenWaveActivationResponse
            {
                SessionId = session.SessionId,
                RouteId = route.RouteId,
                RouteName = route.RouteName,
                Status = "GREEN_WAVE_ACTIVE",
                Junctions = activatedJunctions
            };

            return Ok(response);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, "An error occurred during Green Wave activation. Changes were rolled back.");
        }
    }

    // POST /api/emergencies/{id}/propose-signals
    [HttpPost("{id}/propose-signals")]
    public async Task<ActionResult<SignalActionProposalResponse>> ProposeSignals(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await _signalActionProposalService.ProposeAndPersistAsync(id, cancellationToken);

            if (outcome.Proposal != null)
            {
                return Ok(outcome.Proposal);
            }

            return StatusCode(outcome.StatusCode, outcome.Error);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error requesting Signal Action proposal for session {SessionId}", id);

            return StatusCode(StatusCodes.Status502BadGateway, new AiIntegrationErrorResponse
            {
                Error = "AI_SERVICE_ERROR",
                Message = "The AI service could not produce a signal proposal. No traffic signals were changed."
            });
        }
    }

    // GET /api/emergencies/{id}/ai-workflow
    [HttpGet("{id}/ai-workflow")]
    public async Task<ActionResult<AiWorkflowResponse>> GetAiWorkflow(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await _signalActionProposalService.GetWorkflowAsync(id, cancellationToken);
        if (outcome.Workflow != null)
        {
            return Ok(outcome.Workflow);
        }

        return StatusCode(outcome.StatusCode, outcome.Error);
    }

    // POST /api/emergencies/{id}/ai-workflow/approve
    [HttpPost("{id}/ai-workflow/approve")]
    public async Task<ActionResult<AiWorkflowResponse>> ApproveAiWorkflow(
        Guid id,
        [FromBody] ApprovalDecisionRequest? request,
        CancellationToken cancellationToken)
    {
        var outcome = await _signalActionProposalService.DecideAsync(
            id,
            approve: true,
            request ?? new ApprovalDecisionRequest(),
            cancellationToken);

        if (outcome.Workflow != null)
        {
            return Ok(outcome.Workflow);
        }

        return StatusCode(outcome.StatusCode, outcome.Error);
    }

    // POST /api/emergencies/{id}/ai-workflow/reject
    [HttpPost("{id}/ai-workflow/reject")]
    public async Task<ActionResult<AiWorkflowResponse>> RejectAiWorkflow(
        Guid id,
        [FromBody] ApprovalDecisionRequest? request,
        CancellationToken cancellationToken)
    {
        var outcome = await _signalActionProposalService.DecideAsync(
            id,
            approve: false,
            request ?? new ApprovalDecisionRequest(),
            cancellationToken);

        if (outcome.Workflow != null)
        {
            return Ok(outcome.Workflow);
        }

        return StatusCode(outcome.StatusCode, outcome.Error);
    }

    // GET /api/emergencies/{id}/ai-report
    [HttpGet("{id}/ai-report")]
    public async Task<ActionResult<AiDecisionReportResponse>> GetAiReport(Guid id, CancellationToken cancellationToken)
    {
        var report = await _signalActionProposalService.GetReportAsync(id, cancellationToken);
        if (report == null)
        {
            return NotFound(new AiIntegrationErrorResponse
            {
                Error = "SESSION_NOT_FOUND",
                Message = "Emergency session not found."
            });
        }

        return Ok(report);
    }
}
