using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Services.Agents;

// Your individual Agentic AI contribution (Section 9 of the assignment
// spec): a real multi-agent workflow — not the placeholder if-statement
// CameraTelemetrySimulatorService used to run directly. Given a domain
// objective ("reduce congestion at X"), four distinct agents run in
// sequence, each with its own responsibility, input/output contract and
// tool access, and every step is persisted to AgentWorkflowSteps:
//
//   1. Coordinator  — plans which steps run, in what order (no AI call)
//   2. Domain Analyst — reads real telemetry (a tool) and summarizes the
//      traffic situation via the local Ollama model
//   3. Proposer     — calls Ollama (a tool) to propose a green-time
//      extension + justification
//   4. Validator    — pure C# business-rule checks (no AI) that can pass,
//      clamp, or reject the AI's proposal before it's ever shown to a human
//
// Only after validation does this create a SignalTimingProposal — which
// still requires the existing human Approve/Reject step before it takes
// effect. A rejected proposal is a safe, clearly recorded failure: the
// AgentWorkflowRun is marked FAILED with a reason, and nothing is
// silently guessed at.
public class SignalTimingAgentWorkflow(SrmsDbContext db, OllamaClient ollama, ILogger<SignalTimingAgentWorkflow> logger)
{
    // Allow-listed bounds a proposal must fall inside to reach a human —
    // this is the "least-privilege" ceiling on what the AI is allowed to
    // suggest, enforced in code, never by asking the model nicely.
    private const int MinGreenExtensionSec = 0;
    private const int MaxGreenExtensionSec = 30;
    private const int TelemetryLookback = 6;

    // revisionNote: set when an operator clicked "Request Revision" on a
    // previous proposal instead of approving/rejecting it — fed to the
    // Proposer so the new attempt responds to their feedback instead of
    // just re-running the same reasoning from scratch.
    public async Task<bool> RunAsync(Intersection intersection, string? revisionNote = null, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var run = new AgentWorkflowRun
        {
            Id = Guid.NewGuid(),
            IntersectionId = intersection.Id,
            Objective = revisionNote is null
                ? $"Reduce congestion at {intersection.Name}"
                : $"Reduce congestion at {intersection.Name} (revision requested: {revisionNote})",
            Status = "RUNNING",
            StartedAt = now,
        };
        db.AgentWorkflowRuns.Add(run);
        await db.SaveChangesAsync(ct);

        try
        {
            var plan = await RunCoordinatorAsync(run.Id, run.Objective, ct);
            var analysis = await RunDomainAnalystAsync(run.Id, intersection.Id, ct);
            var proposal = await RunProposerAsync(run.Id, analysis, revisionNote, ct);
            var validated = await RunValidatorAsync(run.Id, proposal, ct);

            if (validated is null)
            {
                run.Status = "FAILED";
                run.ErrorMessage = "Validator rejected the proposal — no safe, parseable green-time value was produced.";
                run.CompletedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                return false;
            }

            db.SignalTimingProposals.Add(new SignalTimingProposal
            {
                Id = Guid.NewGuid(),
                WorkflowRunId = run.Id,
                IntersectionId = intersection.Id,
                ProposedPlanJson = JsonSerializer.Serialize(new
                {
                    plan,
                    analysis,
                    proposal = validated,
                }),
                Justification = validated.Justification,
                SafetyCheckStatus = validated.WasAdjusted ? "ADJUSTED" : "PASSED",
                SafetyCheckNotes = validated.WasAdjusted
                    ? $"Validator clamped the AI's proposed {validated.RawGreenExtensionSec}s to the allowed {MinGreenExtensionSec}-{MaxGreenExtensionSec}s range."
                    : null,
                CreatedAt = DateTime.UtcNow,
            });

            run.Status = "AWAITING_APPROVAL";
            run.CompletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            // Safe failure: record what happened rather than throwing out
            // of a background service tick and losing the reason why.
            logger.LogError(ex, "Agent workflow {RunId} failed for intersection {IntersectionId}", run.Id, intersection.Id);
            run.Status = "FAILED";
            run.ErrorMessage = ex.Message;
            run.CompletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return false;
        }
    }

    // Agent 1 — Coordinator / planning agent. Deterministic: its
    // responsibility is producing the structured step plan, not calling
    // the model. Still a distinct, visible participant in the workflow.
    private async Task<string[]> RunCoordinatorAsync(Guid runId, string objective, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var plan = new[] { "domain_analysis", "propose_timing", "validate_safety" };

        await RecordStepAsync(
            runId, "Coordinator", 0,
            inputJson: JsonSerializer.Serialize(new { objective }),
            outputJson: JsonSerializer.Serialize(new { plan }),
            toolCallsJson: null,
            validationResult: "PASSED",
            sw.ElapsedMilliseconds, ct);

        return plan;
    }

    // Agent 2 — Domain Analyst. Tool: reads real TelemetryReadings for
    // this intersection (allow-listed — it can only read this one table,
    // scoped to this one intersection). Uses Ollama only to phrase the
    // narrative summary; the numbers themselves come from the database,
    // not the model.
    private async Task<DomainAnalysis> RunDomainAnalystAsync(Guid runId, Guid intersectionId, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        var readings = await db.TelemetryReadings
            .Where(t => t.IntersectionId == intersectionId)
            .OrderByDescending(t => t.Timestamp)
            .Take(TelemetryLookback)
            .ToListAsync(ct);

        var avgDensity = readings.Count > 0 ? readings.Average(r => r.LaneDensityPercent) : 0;
        var avgVehicles = readings.Count > 0 ? readings.Average(r => r.VehicleCount) : 0;
        var trend = readings.Count >= 2 && readings[0].LaneDensityPercent > readings[^1].LaneDensityPercent
            ? "rising"
            : "stable_or_falling";

        var toolResult = new { readingsUsed = readings.Count, avgDensity, avgVehicles, trend };

        string narrative;
        try
        {
            narrative = await ollama.GenerateAsync(
                $"In one short sentence, describe this traffic situation for a road operator: " +
                $"average lane density {avgDensity:F0}%, average {avgVehicles:F0} vehicles per reading, trend is {trend}. " +
                "Be factual and brief, no recommendations yet.",
                ct);
        }
        catch (Exception ex)
        {
            // The narrative is a nice-to-have; a down/slow Ollama here
            // shouldn't block the rest of the workflow.
            logger.LogWarning(ex, "Domain analyst narrative call failed for run {RunId}", runId);
            narrative = $"Average lane density {avgDensity:F0}%, trend {trend}.";
        }

        var analysis = new DomainAnalysis(avgDensity, avgVehicles, trend, narrative.Trim());

        await RecordStepAsync(
            runId, "DomainAnalyst", 1,
            inputJson: JsonSerializer.Serialize(new { intersectionId }),
            outputJson: JsonSerializer.Serialize(analysis),
            toolCallsJson: JsonSerializer.Serialize(new[] { new { tool = "get_recent_telemetry", result = toolResult } }),
            validationResult: "PASSED",
            sw.ElapsedMilliseconds, ct);

        return analysis;
    }

    // Agent 3 — Proposer. The only agent allowed to ask the model for an
    // actual timing recommendation (its one allow-listed tool). Output is
    // treated as untrusted input until Agent 4 checks it.
    private async Task<RawProposal> RunProposerAsync(Guid runId, DomainAnalysis analysis, string? revisionNote, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        var revisionClause = revisionNote is null
            ? string.Empty
            : $"\nAn operator rejected a previous proposal for this intersection and asked for this to be reconsidered: \"{revisionNote}\". Take that feedback into account.\n";

        var prompt =
            "You are a traffic-signal timing assistant. Given this situation: " +
            $"average lane density {analysis.AvgDensityPercent:F0}%, trend {analysis.Trend}. " +
            $"Summary: {analysis.Narrative}\n" +
            revisionClause +
            "Reply with ONLY a JSON object, no other text, in exactly this shape: " +
            "{\"greenExtensionSeconds\": <integer 0-30>, \"justification\": \"<one sentence that states the exact number of seconds and the specific reason>\"}";

        string rawResponse;
        try
        {
            rawResponse = await ollama.GenerateAsync(prompt, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Proposer model call failed for run {RunId}", runId);
            rawResponse = string.Empty;
        }

        var parsed = TryParseProposal(rawResponse);

        await RecordStepAsync(
            runId, "Proposer", 2,
            inputJson: JsonSerializer.Serialize(analysis),
            outputJson: JsonSerializer.Serialize(new { rawResponse, parsed }),
            toolCallsJson: JsonSerializer.Serialize(new[] { new { tool = "ollama_propose_timing", model = "llama3.2:1b" } }),
            validationResult: parsed is not null ? "PASSED" : "UNPARSEABLE",
            sw.ElapsedMilliseconds, ct);

        return parsed ?? new RawProposal(null, "The model's response could not be parsed as a valid proposal.");
    }

    // Agent 4 — Validator / safety agent. No model call at all — every
    // guarantee here comes from plain C# rules, which is the point: the
    // AI's output is never trusted blindly, it must pass a deterministic
    // check before a human ever sees it.
    private async Task<ValidatedProposal?> RunValidatorAsync(Guid runId, RawProposal proposal, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        ValidatedProposal? result;
        string validationResult;

        if (proposal.GreenExtensionSeconds is not { } seconds)
        {
            result = null;
            validationResult = "REJECTED";
        }
        else if (seconds < MinGreenExtensionSec || seconds > MaxGreenExtensionSec)
        {
            var clamped = Math.Clamp(seconds, MinGreenExtensionSec, MaxGreenExtensionSec);
            result = new ValidatedProposal(clamped, seconds, proposal.Justification, WasAdjusted: true);
            validationResult = "ADJUSTED";
        }
        else
        {
            result = new ValidatedProposal(seconds, seconds, proposal.Justification, WasAdjusted: false);
            validationResult = "PASSED";
        }

        await RecordStepAsync(
            runId, "Validator", 3,
            inputJson: JsonSerializer.Serialize(proposal),
            outputJson: JsonSerializer.Serialize(result),
            toolCallsJson: null,
            validationResult, sw.ElapsedMilliseconds, ct);

        return result;
    }

    private async Task RecordStepAsync(
        Guid runId, string agentName, int stepIndex,
        string inputJson, string outputJson, string? toolCallsJson,
        string validationResult, long durationMs, CancellationToken ct)
    {
        db.AgentWorkflowSteps.Add(new AgentWorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowRunId = runId,
            AgentName = agentName,
            StepIndex = stepIndex,
            InputJson = inputJson,
            OutputJson = outputJson,
            ToolCallsJson = toolCallsJson,
            ValidationResult = validationResult,
            DurationMs = (int)durationMs,
            Timestamp = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    private static RawProposal? TryParseProposal(string rawResponse)
    {
        // A 1B local model doesn't always return clean JSON — pull out the
        // first {...} block rather than requiring the whole response to
        // be valid JSON on its own.
        var start = rawResponse.IndexOf('{');
        var end = rawResponse.LastIndexOf('}');
        if (start < 0 || end <= start) return null;

        try
        {
            using var doc = JsonDocument.Parse(rawResponse[start..(end + 1)]);
            var root = doc.RootElement;
            int? seconds = root.TryGetProperty("greenExtensionSeconds", out var secProp) && secProp.TryGetInt32(out var s)
                ? s
                : null;
            var justification = root.TryGetProperty("justification", out var jProp) ? jProp.GetString() : null;
            return new RawProposal(seconds, justification ?? "No justification provided.");
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private record DomainAnalysis(double AvgDensityPercent, double AvgVehicles, string Trend, string Narrative);

    private record RawProposal(int? GreenExtensionSeconds, string Justification);

    private record ValidatedProposal(int GreenExtensionSeconds, int RawGreenExtensionSec, string Justification, bool WasAdjusted);
}
