using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;

namespace SRMS.API.Services;

public class SignalActionProposalService
{
    private static readonly JsonSerializerOptions PersistenceJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private static readonly string[] CompletedWorkflowSteps =
    {
        "input_context",
        "tool_retrieval",
        "reasoning",
        "structured_proposal",
        "validation"
    };

    private readonly ApplicationDbContext _context;
    private readonly SignalActionAgentClient _signalActionAgentClient;
    private readonly ILogger<SignalActionProposalService> _logger;

    public SignalActionProposalService(
        ApplicationDbContext context,
        SignalActionAgentClient signalActionAgentClient,
        ILogger<SignalActionProposalService> logger)
    {
        _context = context;
        _signalActionAgentClient = signalActionAgentClient;
        _logger = logger;
    }

    public async Task<ProposeSignalsOutcome> ProposeAndPersistAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await _context.EmergencySessions
            .Include(s => s.SelectedRoute)
            .ThenInclude(r => r!.RouteJunctions)
            .ThenInclude(rj => rj.RoadJunction)
            .FirstOrDefaultAsync(s => s.SessionId == sessionId, cancellationToken);

        if (session == null)
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status404NotFound,
                "SESSION_NOT_FOUND",
                "Emergency session not found.");
        }

        if (session.SelectedRouteId == null || session.SelectedRoute == null)
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "ROUTE_REQUIRED",
                "Emergency session has no selected route. Cannot request a signal proposal.");
        }

        var route = session.SelectedRoute;
        if (route.RouteJunctions == null || !route.RouteJunctions.Any())
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "ROUTE_JUNCTIONS_REQUIRED",
                "Selected route has no junctions. Cannot request a signal proposal.");
        }

        SignalActionProposalResponse proposal;
        try
        {
            proposal = await _signalActionAgentClient.ProposeSignalsAsync(
                session,
                route,
                cancellationToken);
        }
        catch (SignalActionAgentClientException ex)
        {
            _logger.LogWarning(
                "Signal Action proposal failed for session {SessionId} with error {ErrorCode}. No workflow record was persisted.",
                sessionId,
                ex.ErrorCode);

            return ProposeSignalsOutcome.Fail(ex.StatusCode, ex.ErrorCode, ex.Message);
        }

        try
        {
            await PersistProposalAsync(session, proposal, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to persist AI workflow execution for session {SessionId}. No traffic signals were changed.",
                sessionId);

            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status500InternalServerError,
                "AI_WORKFLOW_PERSISTENCE_FAILED",
                "The AI proposal was received but could not be saved. No traffic signals were changed.");
        }

        return ProposeSignalsOutcome.Ok(proposal);
    }

    private async Task PersistProposalAsync(
        EmergencySession session,
        SignalActionProposalResponse proposal,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var isRejected = string.Equals(proposal.ProposalStatus, "REJECTED", StringComparison.OrdinalIgnoreCase)
            || string.Equals(proposal.ApprovalStatus, "REJECTED", StringComparison.OrdinalIgnoreCase)
            || string.Equals(proposal.WorkflowStatus, "FAILED", StringComparison.OrdinalIgnoreCase)
            || string.Equals(proposal.WorkflowStatus, "REJECTED", StringComparison.OrdinalIgnoreCase);

        var workflow = await _context.AiWorkflowExecutions
            .FirstOrDefaultAsync(w => w.SessionId == session.SessionId, cancellationToken);

        if (workflow == null)
        {
            workflow = new AiWorkflowExecution
            {
                SessionId = session.SessionId,
                CreatedAt = now
            };
            _context.AiWorkflowExecutions.Add(workflow);
        }

        workflow.ThreadId = proposal.ThreadId;
        workflow.ProposalId = proposal.ProposalId;
        workflow.Objective = "Emergency Green Wave signal action proposal";
        workflow.CurrentStage = "validation";
        workflow.CompletedStepsJson = JsonSerializer.Serialize(CompletedWorkflowSteps, PersistenceJsonOptions);
        workflow.WorkflowStatus = string.IsNullOrWhiteSpace(proposal.WorkflowStatus)
            ? (isRejected ? "REJECTED" : "COMPLETED")
            : proposal.WorkflowStatus;
        workflow.ProposalStatus = proposal.ProposalStatus;
        workflow.ApprovalStatus = proposal.ApprovalStatus;
        workflow.IsValid = !isRejected;
        workflow.HandoffReady = proposal.HandoffReady;
        workflow.ValidationNotesJson = JsonSerializer.Serialize(
            proposal.ValidationNotes ?? new List<string>(),
            PersistenceJsonOptions);
        workflow.ProposedActionsJson = JsonSerializer.Serialize(
            (proposal.ProposedJunctionActions ?? new List<JunctionAction>())
                .Select(a => new
                {
                    a.JunctionId,
                    a.JunctionName,
                    a.SequenceOrder,
                    a.Action,
                    a.TargetSignalState,
                    a.HoldDurationSeconds
                }),
            PersistenceJsonOptions);
        workflow.ErrorSummary = isRejected
            ? "AI proposal was rejected by deterministic validation."
            : null;
        workflow.ApprovedAt = null;
        workflow.ApprovedBy = null;
        workflow.ApprovalNotes = null;
        workflow.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Persisted AI workflow {WorkflowId} for session {SessionId} with proposal_status {ProposalStatus} and approval_status {ApprovalStatus}",
            workflow.WorkflowId,
            session.SessionId,
            workflow.ProposalStatus,
            workflow.ApprovalStatus);
    }

    public async Task<ProposeSignalsOutcome> GetWorkflowAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var workflow = await _context.AiWorkflowExecutions
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.SessionId == sessionId, cancellationToken);

        if (workflow == null)
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status404NotFound,
                "WORKFLOW_NOT_FOUND",
                "No AI workflow exists for this emergency session.");
        }

        return ProposeSignalsOutcome.OkWorkflow(MapWorkflow(
            workflow,
            await HasSignalExecutionAsync(sessionId, cancellationToken)));
    }

    public async Task<ProposeSignalsOutcome> DecideAsync(
        Guid sessionId,
        bool approve,
        ApprovalDecisionRequest request,
        CancellationToken cancellationToken)
    {
        var workflow = await _context.AiWorkflowExecutions
            .FirstOrDefaultAsync(w => w.SessionId == sessionId, cancellationToken);

        if (workflow == null)
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status404NotFound,
                "WORKFLOW_NOT_FOUND",
                "No AI workflow exists for this emergency session.");
        }

        if (string.IsNullOrWhiteSpace(workflow.ThreadId))
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "THREAD_REQUIRED",
                "The AI workflow does not have a thread ID and cannot be approved.");
        }

        if (!workflow.IsValid && approve)
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "PROPOSAL_INVALID",
                "This proposal did not pass deterministic validation and cannot be approved.");
        }

        if (approve && string.Equals(workflow.ApprovalStatus, "REJECTED", StringComparison.OrdinalIgnoreCase))
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "INVALID_APPROVAL_TRANSITION",
                "A rejected proposal cannot be approved.");
        }

        if (approve && string.Equals(workflow.ApprovalStatus, "APPROVED", StringComparison.OrdinalIgnoreCase))
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "INVALID_APPROVAL_TRANSITION",
                "This proposal is already approved.");
        }

        if (!approve && string.Equals(workflow.ApprovalStatus, "APPROVED", StringComparison.OrdinalIgnoreCase))
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "INVALID_APPROVAL_TRANSITION",
                "An approved proposal cannot be rejected.");
        }

        if (!approve && string.Equals(workflow.ApprovalStatus, "REJECTED", StringComparison.OrdinalIgnoreCase))
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "INVALID_APPROVAL_TRANSITION",
                "This proposal is already rejected.");
        }

        if (!string.Equals(workflow.ApprovalStatus, "PENDING_APPROVAL", StringComparison.OrdinalIgnoreCase))
        {
            return ProposeSignalsOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "INVALID_APPROVAL_TRANSITION",
                $"Approval decision is not allowed from status {workflow.ApprovalStatus}.");
        }

        var operatorId = string.IsNullOrWhiteSpace(request.OperatorId)
            ? "traffic_operator"
            : request.OperatorId.Trim();
        var notes = request.Notes?.Trim();

        PythonApprovalResponse decision;
        try
        {
            decision = approve
                ? await _signalActionAgentClient.ApproveAsync(workflow.ThreadId, operatorId, notes, cancellationToken)
                : await _signalActionAgentClient.RejectAsync(workflow.ThreadId, operatorId, notes, cancellationToken);
        }
        catch (SignalActionAgentClientException ex)
        {
            _logger.LogWarning(
                "AI approval call failed for session {SessionId} with error {ErrorCode}. PostgreSQL approval state was not changed.",
                sessionId,
                ex.ErrorCode);

            return ProposeSignalsOutcome.Fail(ex.StatusCode, ex.ErrorCode, ex.Message);
        }

        workflow.ApprovalStatus = decision.ApprovalStatus;
        workflow.ProposalStatus = string.IsNullOrWhiteSpace(decision.ProposalStatus)
            ? workflow.ProposalStatus
            : decision.ProposalStatus;
        workflow.HandoffReady = decision.HandoffReady;
        workflow.IsValid = decision.IsValid;
        workflow.ApprovedAt = decision.ApprovedAt;
        workflow.ApprovedBy = decision.ApprovedBy ?? operatorId;
        workflow.ApprovalNotes = decision.ApprovalNotes ?? notes;
        workflow.CurrentStage = approve ? "approved" : "rejected";
        workflow.ErrorSummary = approve ? null : (decision.Message ?? "Proposal rejected by traffic operator.");
        workflow.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Persisted approval decision {ApprovalStatus} for session {SessionId}. Handoff ready: {HandoffReady}. Signal execution performed: false",
            workflow.ApprovalStatus,
            sessionId,
            workflow.HandoffReady);

        return ProposeSignalsOutcome.OkWorkflow(MapWorkflow(
            workflow,
            await HasSignalExecutionAsync(sessionId, cancellationToken)));
    }

    public async Task<AiIntegrationErrorResponse?> GetGreenWaveActivationBlockReasonAsync(
        Guid sessionId,
        IEnumerable<Guid> routeJunctionIds,
        CancellationToken cancellationToken)
    {
        var workflow = await _context.AiWorkflowExecutions
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.SessionId == sessionId, cancellationToken);

        if (workflow == null)
        {
            return new AiIntegrationErrorResponse
            {
                Error = "APPROVAL_REQUIRED",
                Message = "An AI proposal must be generated and approved before Green Wave activation."
            };
        }

        if (!workflow.IsValid
            || !string.Equals(workflow.ApprovalStatus, "APPROVED", StringComparison.OrdinalIgnoreCase)
            || !workflow.HandoffReady)
        {
            return new AiIntegrationErrorResponse
            {
                Error = "APPROVAL_REQUIRED",
                Message = "An approved AI proposal with a ready handoff is required before Green Wave activation."
            };
        }

        var proposed = DeserializeActions(workflow.ProposedActionsJson);
        if (proposed.Count > 0)
        {
            var proposedIds = proposed
                .Select(a => Guid.TryParse(a.JunctionId, out var id) ? id : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .ToHashSet();
            var routeIds = routeJunctionIds.ToHashSet();

            if (!proposedIds.SetEquals(routeIds))
            {
                return new AiIntegrationErrorResponse
                {
                    Error = "PROPOSAL_ROUTE_MISMATCH",
                    Message = "The approved proposal junctions do not match the selected emergency route."
                };
            }
        }

        return null;
    }

    public async Task<AiDecisionReportResponse?> GetReportAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await _context.EmergencySessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SessionId == sessionId, cancellationToken);

        if (session == null)
        {
            return null;
        }

        var workflow = await _context.AiWorkflowExecutions
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.SessionId == sessionId, cancellationToken);

        RouteResponse? route = null;
        if (session.SelectedRouteId.HasValue)
        {
            route = await _context.Routes
                .Where(r => r.RouteId == session.SelectedRouteId.Value)
                .Select(r => new RouteResponse
                {
                    RouteId = r.RouteId,
                    RouteName = r.RouteName,
                    StartLocation = r.StartLocation,
                    Destination = r.Destination,
                    DistanceKm = r.DistanceKm,
                    EstimatedTimeMinutes = r.EstimatedTimeMinutes,
                    TrafficLevel = r.TrafficLevel,
                    Junctions = r.RouteJunctions
                        .OrderBy(rj => rj.SequenceNumber)
                        .Select(rj => new RouteJunctionResponse
                        {
                            JunctionId = rj.RoadJunction.JunctionId,
                            JunctionName = rj.RoadJunction.JunctionName,
                            Latitude = rj.RoadJunction.Latitude,
                            Longitude = rj.RoadJunction.Longitude,
                            CurrentSignalState = rj.RoadJunction.CurrentSignalState,
                            SequenceNumber = rj.SequenceNumber
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync(cancellationToken);
        }

        var logs = await _context.SignalPreemptionLogs
            .AsNoTracking()
            .Include(l => l.RoadJunction)
            .Where(l => l.SessionId == sessionId)
            .OrderBy(l => l.ActivatedAt)
            .ToListAsync(cancellationToken);

        var active = logs.Where(l => l.IsActive).ToList();
        var restored = logs.Where(l => !l.IsActive && l.DeactivatedAt != null).ToList();

        var greenWaveStatus = "NOT_STARTED";
        if (active.Count > 0)
        {
            greenWaveStatus = "GREEN_WAVE_ACTIVE";
        }
        else if (restored.Count > 0)
        {
            greenWaveStatus = "RESTORED";
        }

        return new AiDecisionReportResponse
        {
            Emergency = new EmergencySessionResponse
            {
                SessionId = session.SessionId,
                DriverId = session.DriverId,
                VehicleType = session.VehicleType,
                Status = session.Status,
                SelectedRouteId = session.SelectedRouteId,
                CreatedAt = session.CreatedAt,
                UpdatedAt = session.UpdatedAt
            },
            Route = route,
            Workflow = workflow == null
                ? null
                : MapWorkflow(workflow, logs.Count > 0),
            GreenWave = new GreenWaveExecutionSummary
            {
                Status = greenWaveStatus,
                ActivatedAt = logs.Where(l => l.ActivatedAt.HasValue).Min(l => l.ActivatedAt),
                RestoredAt = restored.Count > 0 ? restored.Max(l => l.DeactivatedAt) : null,
                Junctions = (active.Count > 0 ? active : logs).Select((l, index) => new ActivatedJunctionInfo
                {
                    JunctionId = l.JunctionId,
                    JunctionName = l.RoadJunction?.JunctionName ?? string.Empty,
                    SequenceNumber = index + 1,
                    SignalState = l.IsActive ? "GREEN" : (l.PreviousSignalState ?? "UNKNOWN")
                }).ToList(),
                RestoredJunctions = restored.Select(l => new RestoredJunctionInfo
                {
                    JunctionId = l.JunctionId,
                    JunctionName = l.RoadJunction?.JunctionName ?? string.Empty,
                    RestoredSignalState = l.PreviousSignalState ?? string.Empty
                }).ToList()
            },
            ErrorSummary = workflow?.ErrorSummary
        };
    }

    private async Task<bool> HasSignalExecutionAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        return await _context.SignalPreemptionLogs
            .AsNoTracking()
            .AnyAsync(log => log.SessionId == sessionId, cancellationToken);
    }

    private static AiWorkflowResponse MapWorkflow(
        AiWorkflowExecution workflow,
        bool signalExecutionPerformed)
    {
        return new AiWorkflowResponse
        {
            WorkflowId = workflow.WorkflowId,
            SessionId = workflow.SessionId,
            ThreadId = workflow.ThreadId,
            ProposalId = workflow.ProposalId,
            Objective = workflow.Objective,
            CurrentStage = workflow.CurrentStage,
            CompletedSteps = DeserializeStringList(workflow.CompletedStepsJson),
            WorkflowStatus = workflow.WorkflowStatus,
            ProposalStatus = workflow.ProposalStatus,
            ApprovalStatus = workflow.ApprovalStatus,
            IsValid = workflow.IsValid,
            HandoffReady = workflow.HandoffReady,
            SignalExecutionPerformed = signalExecutionPerformed,
            ValidationNotes = DeserializeStringList(workflow.ValidationNotesJson),
            ProposedActions = DeserializeActions(workflow.ProposedActionsJson),
            ErrorSummary = workflow.ErrorSummary,
            ApprovedAt = workflow.ApprovedAt,
            ApprovedBy = workflow.ApprovedBy,
            ApprovalNotes = workflow.ApprovalNotes,
            CreatedAt = workflow.CreatedAt,
            UpdatedAt = workflow.UpdatedAt
        };
    }

    private static List<string> DeserializeStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, PersistenceJsonOptions) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }

    private static List<PersistedJunctionAction> DeserializeActions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<PersistedJunctionAction>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<PersistedJunctionAction>>(json, PersistenceJsonOptions)
                ?? new List<PersistedJunctionAction>();
        }
        catch (JsonException)
        {
            return new List<PersistedJunctionAction>();
        }
    }
}

public class ProposeSignalsOutcome
{
    public int StatusCode { get; init; }

    public SignalActionProposalResponse? Proposal { get; init; }

    public AiWorkflowResponse? Workflow { get; init; }

    public AiIntegrationErrorResponse? Error { get; init; }

    public static ProposeSignalsOutcome Ok(SignalActionProposalResponse proposal) => new()
    {
        StatusCode = StatusCodes.Status200OK,
        Proposal = proposal
    };

    public static ProposeSignalsOutcome OkWorkflow(AiWorkflowResponse workflow) => new()
    {
        StatusCode = StatusCodes.Status200OK,
        Workflow = workflow
    };

    public static ProposeSignalsOutcome Fail(int statusCode, string error, string message) => new()
    {
        StatusCode = statusCode,
        Error = new AiIntegrationErrorResponse
        {
            Error = error,
            Message = message
        }
    };
}
