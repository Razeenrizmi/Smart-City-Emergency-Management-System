using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SRMS.API.Configuration;
using SRMS.API.Controllers;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;
using SRMS.API.Services;
using Xunit;

namespace SRMS.API.Tests;

public sealed class EmergencyGreenWavePostgresTests : IAsyncLifetime
{
    private const string RouteId = "22222222-2222-2222-2222-222222222201";
    private readonly string _connectionString;
    private readonly ApplicationDbContext _db;
    private readonly EmergencySessionsController _controller;

    public EmergencyGreenWavePostgresTests()
    {
        _connectionString = Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION")
            ?? new ConfigurationBuilder()
                .AddUserSecrets<EmergencyGreenWavePostgresTests>()
                .Build()["ConnectionStrings:DefaultConnection"]
            ?? throw new InvalidOperationException(
                "Set TEST_POSTGRES_CONNECTION or configure the shared ASP.NET user secret before running backend tests.");

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_connectionString)
            .Options;
        _db = new ApplicationDbContext(options);

        var httpClient = new HttpClient { BaseAddress = new Uri("http://localhost:8000/") };
        var agentClient = new SignalActionAgentClient(
            httpClient,
            Options.Create(new AiServiceOptions { BaseUrl = "http://localhost:8000", TimeoutSeconds = 1 }),
            NullLogger<SignalActionAgentClient>.Instance);
        var proposalService = new SignalActionProposalService(
            _db,
            agentClient,
            NullLogger<SignalActionProposalService>.Instance);

        _controller = new EmergencySessionsController(
            _db,
            proposalService,
            NullLogger<EmergencySessionsController>.Instance);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
    }

    public async Task InitializeAsync()
    {
        await _db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        var sessionIds = await _db.EmergencySessions
            .Where(session => session.DriverId == TestDriverId)
            .Select(session => session.SessionId)
            .ToListAsync();

        if (sessionIds.Count > 0)
        {
            await _db.SignalPreemptionLogs
                .Where(log => sessionIds.Contains(log.SessionId))
                .ExecuteDeleteAsync();
            await _db.AiWorkflowExecutions
                .Where(workflow => sessionIds.Contains(workflow.SessionId))
                .ExecuteDeleteAsync();
            await _db.EmergencySessions
                .Where(session => sessionIds.Contains(session.SessionId))
                .ExecuteDeleteAsync();
        }

        await _db.DisposeAsync();
    }

    private static readonly Guid TestDriverId =
        Guid.Parse("99999999-9999-9999-9999-999999999991");

    [Fact]
    public async Task Creates_session_with_selected_route_and_rejects_missing_route()
    {
        var created = await _controller.CreateEmergencySession(new CreateEmergencySessionRequest
        {
            DriverId = TestDriverId,
            VehicleType = "Ambulance",
            SelectedRouteId = Guid.Parse(RouteId),
        });

        var createdResult = Assert.IsType<CreatedAtActionResult>(created.Result);
        var response = Assert.IsType<EmergencySessionResponse>(createdResult.Value);
        Assert.Equal(Guid.Parse(RouteId), response.SelectedRouteId);
        Assert.Equal("ACTIVE", response.Status);

        var invalid = await _controller.CreateEmergencySession(new CreateEmergencySessionRequest
        {
            DriverId = TestDriverId,
            VehicleType = "Ambulance",
            SelectedRouteId = Guid.NewGuid(),
        });

        Assert.IsType<BadRequestObjectResult>(invalid.Result);
    }

    [Fact]
    public async Task Retrieves_route_junctions_in_sequence_order()
    {
        var result = await new RoutesController(_db).GetRoute(Guid.Parse(RouteId));
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var route = Assert.IsType<RouteResponse>(ok.Value);

        Assert.NotEmpty(route.Junctions);
        Assert.Equal(
            route.Junctions.OrderBy(junction => junction.SequenceNumber).Select(junction => junction.JunctionId),
            route.Junctions.Select(junction => junction.JunctionId));
    }

    [Fact]
    public async Task Activates_and_completes_restoring_each_original_signal_state()
    {
        var session = await CreateSessionAsync();
        var routeJunctions = await _db.RouteJunctions
            .Where(item => item.RouteId == Guid.Parse(RouteId))
            .OrderBy(item => item.SequenceNumber)
            .Select(item => item.RoadJunction)
            .ToListAsync();
        var originalStates = new[] { "RED", "YELLOW", "GREEN" };

        for (var index = 0; index < routeJunctions.Count; index++)
        {
            routeJunctions[index].CurrentSignalState = originalStates[index % originalStates.Length];
        }

        await _db.SaveChangesAsync();
        await SeedApprovedWorkflowAsync(session.SessionId);

        var activation = await _controller.ActivateGreenWave(session.SessionId);
        var activationResponse = Assert.IsType<OkObjectResult>(activation.Result);
        var activated = Assert.IsType<GreenWaveActivationResponse>(activationResponse.Value);
        Assert.Equal(routeJunctions.Count, activated.Junctions.Count);
        Assert.All(routeJunctions, junction => Assert.Equal("GREEN", junction.CurrentSignalState));

        var logs = await _db.SignalPreemptionLogs
            .Where(log => log.SessionId == session.SessionId)
            .OrderBy(log => log.JunctionId)
            .ToListAsync();
        Assert.Equal(routeJunctions.Count, logs.Count);
        Assert.Contains(logs, log => log.PreviousSignalState == "RED");
        Assert.Contains(logs, log => log.PreviousSignalState == "YELLOW");
        Assert.Contains(logs, log => log.PreviousSignalState == "GREEN");

        var completion = await _controller.CompleteEmergencySession(session.SessionId);
        var completionResponse = Assert.IsType<OkObjectResult>(completion.Result);
        var completed = Assert.IsType<EmergencyCompletionResponse>(completionResponse.Value);
        Assert.Equal("COMPLETED", completed.Status);
        Assert.True(completed.GreenWaveRestored);

        await _db.Entry(session).ReloadAsync();
        await _db.Entry(routeJunctions[0]).ReloadAsync();
        await _db.Entry(routeJunctions[1]).ReloadAsync();
        await _db.Entry(routeJunctions[2]).ReloadAsync();
        Assert.Equal(originalStates[0], routeJunctions[0].CurrentSignalState);
        Assert.Equal(originalStates[1], routeJunctions[1].CurrentSignalState);
        Assert.Equal(originalStates[2], routeJunctions[2].CurrentSignalState);
        Assert.All(
            await _db.SignalPreemptionLogs.Where(log => log.SessionId == session.SessionId).ToListAsync(),
            log => Assert.False(log.IsActive));
    }

    [Fact]
    public async Task Cancellation_marks_session_cancelled_without_restoring_signals()
    {
        var session = await CreateSessionAsync();
        var junction = await _db.RouteJunctions
            .Where(item => item.RouteId == Guid.Parse(RouteId))
            .OrderBy(item => item.SequenceNumber)
            .Select(item => item.RoadJunction)
            .FirstAsync();
        junction.CurrentSignalState = "YELLOW";
        await _db.SaveChangesAsync();

        var result = await _controller.CancelEmergencySession(session.SessionId);
        var response = Assert.IsType<OkObjectResult>(result.Result);
        var cancelled = Assert.IsType<EmergencySessionResponse>(response.Value);

        Assert.Equal("CANCELLED", cancelled.Status);
        await _db.Entry(junction).ReloadAsync();
        Assert.Equal("YELLOW", junction.CurrentSignalState);
    }

    [Fact]
    public async Task Rejects_activation_without_route_and_duplicate_activation()
    {
        var noRoute = await CreateSessionAsync(includeRoute: false);
        var noRouteResult = await _controller.ActivateGreenWave(noRoute.SessionId);
        Assert.IsType<BadRequestObjectResult>(noRouteResult.Result);

        var session = await CreateSessionAsync();
        await SeedApprovedWorkflowAsync(session.SessionId);
        var first = await _controller.ActivateGreenWave(session.SessionId);
        Assert.IsType<OkObjectResult>(first.Result);
        var duplicate = await _controller.ActivateGreenWave(session.SessionId);
        Assert.IsType<BadRequestObjectResult>(duplicate.Result);
    }

    [Fact]
    public async Task Rejects_activation_when_ai_workflow_does_not_exist_without_side_effects()
    {
        var session = await CreateSessionAsync();
        var before = await CaptureSignalStatesAsync();

        var result = await _controller.ActivateGreenWave(session.SessionId);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(badRequest.Value);
        await AssertNoActivationSideEffectsAsync(session.SessionId, before);
    }

    [Fact]
    public async Task Rejects_activation_when_workflow_is_not_approved_or_handoff_ready()
    {
        var notApproved = await CreateSessionAsync();
        await SeedWorkflowAsync(notApproved.SessionId, "PENDING_APPROVAL", false);
        var beforeNotApproved = await CaptureSignalStatesAsync();

        var notApprovedResult = await _controller.ActivateGreenWave(notApproved.SessionId);

        Assert.IsType<BadRequestObjectResult>(notApprovedResult.Result);
        await AssertNoActivationSideEffectsAsync(notApproved.SessionId, beforeNotApproved);

        var notReady = await CreateSessionAsync();
        await SeedWorkflowAsync(notReady.SessionId, "APPROVED", false);
        var beforeNotReady = await CaptureSignalStatesAsync();

        var notReadyResult = await _controller.ActivateGreenWave(notReady.SessionId);

        Assert.IsType<BadRequestObjectResult>(notReadyResult.Result);
        await AssertNoActivationSideEffectsAsync(notReady.SessionId, beforeNotReady);
    }

    [Fact]
    public async Task Allows_activation_only_when_workflow_is_approved_and_handoff_ready()
    {
        var session = await CreateSessionAsync();
        await SeedWorkflowAsync(session.SessionId, "APPROVED", true);

        var result = await _controller.ActivateGreenWave(session.SessionId);

        var response = Assert.IsType<OkObjectResult>(result.Result);
        var activation = Assert.IsType<GreenWaveActivationResponse>(response.Value);
        Assert.Equal("GREEN_WAVE_ACTIVE", activation.Status);
        Assert.All(
            await _db.SignalPreemptionLogs.Where(log => log.SessionId == session.SessionId).ToListAsync(),
            log => Assert.True(log.IsActive));
    }

    private async Task<EmergencySession> CreateSessionAsync(Guid? routeId = null, bool includeRoute = true)
    {
        var result = await _controller.CreateEmergencySession(new CreateEmergencySessionRequest
        {
            DriverId = TestDriverId,
            VehicleType = "Ambulance",
            SelectedRouteId = includeRoute ? routeId ?? Guid.Parse(RouteId) : null,
        });
        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<EmergencySessionResponse>(created.Value);
        return await _db.EmergencySessions.SingleAsync(session => session.SessionId == response.SessionId);
    }

    private async Task SeedApprovedWorkflowAsync(Guid sessionId)
    {
        await SeedWorkflowAsync(sessionId, "APPROVED", true);
    }

    private async Task SeedWorkflowAsync(Guid sessionId, string approvalStatus, bool handoffReady)
    {
        _db.AiWorkflowExecutions.Add(new AiWorkflowExecution
        {
            SessionId = sessionId,
            Objective = "Test proposal",
            WorkflowStatus = "COMPLETED",
            ProposalStatus = approvalStatus,
            ApprovalStatus = approvalStatus,
            IsValid = true,
            HandoffReady = handoffReady,
            ApprovedAt = DateTime.UtcNow,
            ApprovedBy = "test-operator",
        });
        await _db.SaveChangesAsync();
    }

    private async Task<Dictionary<Guid, string>> CaptureSignalStatesAsync()
    {
        return await _db.RoadJunctions
            .ToDictionaryAsync(junction => junction.JunctionId, junction => junction.CurrentSignalState);
    }

    private async Task AssertNoActivationSideEffectsAsync(
        Guid sessionId,
        IReadOnlyDictionary<Guid, string> previousStates)
    {
        var currentStates = await CaptureSignalStatesAsync();
        Assert.Equal(previousStates, currentStates);
        Assert.Empty(await _db.SignalPreemptionLogs
            .Where(log => log.SessionId == sessionId)
            .ToListAsync());
    }
}
