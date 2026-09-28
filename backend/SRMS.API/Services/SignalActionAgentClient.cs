using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SRMS.API.Configuration;
using SRMS.API.DTOs;
using SRMS.API.Models;

namespace SRMS.API.Services;

public class SignalActionAgentClient
{
    private const string ProposeSignalsPath = "api/v1/agent/propose-signals";

    private static readonly JsonSerializerOptions PythonJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _httpClient;
    private readonly ILogger<SignalActionAgentClient> _logger;

    public SignalActionAgentClient(
        HttpClient httpClient,
        IOptions<AiServiceOptions> options,
        ILogger<SignalActionAgentClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        var baseUrl = options.Value.BaseUrl?.Trim();
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new InvalidOperationException("AiService:BaseUrl is not configured.");
        }

        if (_httpClient.BaseAddress == null)
        {
            _httpClient.BaseAddress = new Uri(AppendTrailingSlash(baseUrl));
        }
    }

    public async Task<SignalActionProposalResponse> ProposeSignalsAsync(
        EmergencySession session,
        TrafficRoute route,
        CancellationToken cancellationToken)
    {
        var request = BuildRequest(session, route);

        _logger.LogInformation(
            "Requesting Signal Action proposal from AI service for session {SessionId} on route {RouteId}",
            session.SessionId,
            route.RouteId);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsJsonAsync(
                ProposeSignalsPath,
                request,
                PythonJsonOptions,
                cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "AI service timed out while proposing signals for session {SessionId}", session.SessionId);
            throw new SignalActionAgentClientException(
                StatusCodes.Status504GatewayTimeout,
                "AI_SERVICE_TIMEOUT",
                "The AI service did not respond in time. No traffic signals were changed.");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "AI service is unavailable while proposing signals for session {SessionId}", session.SessionId);
            throw new SignalActionAgentClientException(
                StatusCodes.Status503ServiceUnavailable,
                "AI_SERVICE_UNAVAILABLE",
                "The AI service is unavailable. No traffic signals were changed.");
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "AI service returned HTTP {StatusCode} for session {SessionId}",
                (int)response.StatusCode,
                session.SessionId);

            var status = response.StatusCode == HttpStatusCode.RequestTimeout
                ? StatusCodes.Status504GatewayTimeout
                : StatusCodes.Status502BadGateway;

            throw new SignalActionAgentClientException(
                status,
                "AI_SERVICE_HTTP_ERROR",
                "The AI service returned an unsuccessful response. No traffic signals were changed.");
        }

        SignalActionProposalResponse? proposal;
        try
        {
            proposal = JsonSerializer.Deserialize<SignalActionProposalResponse>(body, PythonJsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "AI service returned invalid JSON for session {SessionId}", session.SessionId);
            throw new SignalActionAgentClientException(
                StatusCodes.Status502BadGateway,
                "AI_SERVICE_INVALID_JSON",
                "The AI service returned an invalid response. No traffic signals were changed.");
        }

        if (!IsUsableProposal(proposal))
        {
            _logger.LogError(
                "AI service returned an unusable proposal for session {SessionId}",
                session.SessionId);
            throw new SignalActionAgentClientException(
                StatusCodes.Status502BadGateway,
                "AI_SERVICE_INVALID_PROPOSAL",
                "The AI service returned an unusable proposal. No traffic signals were changed.");
        }

        _logger.LogInformation(
            "Received Signal Action proposal {ProposalId} for session {SessionId} with approval_status {ApprovalStatus}, handoff_ready {HandoffReady}",
            proposal!.ProposalId,
            session.SessionId,
            proposal.ApprovalStatus,
            proposal.HandoffReady);

        return proposal;
    }

    public async Task<PythonApprovalResponse> ApproveAsync(
        string threadId,
        string? operatorId,
        string? notes,
        CancellationToken cancellationToken)
    {
        return await PostApprovalAsync(
            $"api/v1/agent/approve/{Uri.EscapeDataString(threadId)}",
            threadId,
            operatorId,
            notes,
            cancellationToken);
    }

    public async Task<PythonApprovalResponse> RejectAsync(
        string threadId,
        string? operatorId,
        string? notes,
        CancellationToken cancellationToken)
    {
        return await PostApprovalAsync(
            $"api/v1/agent/reject/{Uri.EscapeDataString(threadId)}",
            threadId,
            operatorId,
            notes,
            cancellationToken);
    }

    private async Task<PythonApprovalResponse> PostApprovalAsync(
        string path,
        string threadId,
        string? operatorId,
        string? notes,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Sending Signal Action approval request for thread {ThreadId}", threadId);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsJsonAsync(
                path,
                new PythonApprovalRequest { OperatorId = operatorId, Notes = notes },
                PythonJsonOptions,
                cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "AI service timed out during approval for thread {ThreadId}", threadId);
            throw new SignalActionAgentClientException(
                StatusCodes.Status504GatewayTimeout,
                "AI_SERVICE_TIMEOUT",
                "The AI service did not respond in time. No traffic signals were changed.");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "AI service is unavailable during approval for thread {ThreadId}", threadId);
            throw new SignalActionAgentClientException(
                StatusCodes.Status503ServiceUnavailable,
                "AI_SERVICE_UNAVAILABLE",
                "The AI service is unavailable. No traffic signals were changed.");
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "AI service returned HTTP {StatusCode} during approval for thread {ThreadId}",
                (int)response.StatusCode,
                threadId);

            var status = (int)response.StatusCode == 404
                ? StatusCodes.Status404NotFound
                : (int)response.StatusCode == 400
                    ? StatusCodes.Status400BadRequest
                    : StatusCodes.Status502BadGateway;

            throw new SignalActionAgentClientException(
                status,
                "AI_APPROVAL_HTTP_ERROR",
                "The AI approval request was not accepted. No traffic signals were changed.");
        }

        PythonApprovalResponse? approval;
        try
        {
            approval = JsonSerializer.Deserialize<PythonApprovalResponse>(body, PythonJsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "AI service returned invalid approval JSON for thread {ThreadId}", threadId);
            throw new SignalActionAgentClientException(
                StatusCodes.Status502BadGateway,
                "AI_SERVICE_INVALID_JSON",
                "The AI service returned an invalid approval response. No traffic signals were changed.");
        }

        if (approval == null || string.IsNullOrWhiteSpace(approval.ApprovalStatus))
        {
            throw new SignalActionAgentClientException(
                StatusCodes.Status502BadGateway,
                "AI_SERVICE_INVALID_PROPOSAL",
                "The AI service returned an unusable approval response. No traffic signals were changed.");
        }

        return approval;
    }

    private static SignalActionAgentRequest BuildRequest(EmergencySession session, TrafficRoute route)
    {
        var orderedJunctions = route.RouteJunctions
            .OrderBy(rj => rj.SequenceNumber)
            .Select(rj => new JunctionInput
            {
                JunctionId = rj.RoadJunction.JunctionId.ToString(),
                JunctionName = rj.RoadJunction.JunctionName,
                SequenceOrder = rj.SequenceNumber,
                CurrentSignalState = rj.RoadJunction.CurrentSignalState
            })
            .ToList();

        var currentSignalStates = orderedJunctions.ToDictionary(
            j => j.JunctionId,
            j => j.CurrentSignalState ?? "UNKNOWN");

        return new SignalActionAgentRequest
        {
            EmergencySessionId = session.SessionId.ToString(),
            VehicleId = session.DriverId.ToString(),
            VehicleType = session.VehicleType,
            RouteId = route.RouteId.ToString(),
            RouteName = route.RouteName,
            OrderedJunctions = orderedJunctions,
            CurrentSignalStates = currentSignalStates,
            ThreadId = $"thread_{session.SessionId}"
        };
    }

    private static bool IsUsableProposal(SignalActionProposalResponse? proposal)
    {
        if (proposal == null)
        {
            return false;
        }

        return !string.IsNullOrWhiteSpace(proposal.ProposalId)
            && !string.IsNullOrWhiteSpace(proposal.EmergencySessionId)
            && !string.IsNullOrWhiteSpace(proposal.ApprovalStatus)
            && !string.IsNullOrWhiteSpace(proposal.ProposalStatus);
    }

    private static string AppendTrailingSlash(string baseUrl)
    {
        return baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/";
    }
}
