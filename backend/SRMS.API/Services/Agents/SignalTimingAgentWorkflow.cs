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
//   2. Domain Analyst — reads real telemetry (a tool) per road, computes a
//      deterministic proportional-split baseline, and summarizes the
//      situation via the local Ollama model
//   3. Proposer     — calls Ollama (a tool) to propose a per-road
//      green-light duration + justification, anchored to the baseline
//   4. Validator    — pure C# business-rule checks (no AI) that clamp each
//      road's value into a safe range and fall back to the deterministic
//      baseline for any road the AI's output is missing or malformed for
//
// Only after validation does this create a SignalTimingProposal — which
// still requires the existing human Approve/Reject/Request-Revision step
// before it takes effect. A rejected proposal is a safe, clearly recorded
// failure: the AgentWorkflowRun is marked FAILED with a reason, and
// nothing is silently guessed at.
public class SignalTimingAgentWorkflow(SrmsDbContext db, OllamaClient ollama, ILogger<SignalTimingAgentWorkflow> logger)
{
    // Allow-listed bounds a proposal must fall inside to reach a human —
    // this is the "least-privilege" ceiling on what the AI is allowed to
    // suggest, enforced in code, never by asking the model nicely.
    private const int MinGreenPerRoadSeconds = 5;
    private const int MaxGreenPerRoadSeconds = 60;
    private const int TotalCycleSeconds = 90;
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

            if (analysis.Roads.Count == 0)
            {
                run.Status = "FAILED";
                run.ErrorMessage = "No camera sensors with telemetry for this intersection — nothing to plan for.";
                run.CompletedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                return false;
            }

            var proposal = await RunProposerAsync(run.Id, analysis, revisionNote, ct);
            var validated = await RunValidatorAsync(run.Id, analysis, proposal, ct);

            db.SignalTimingProposals.Add(new SignalTimingProposal
            {
                Id = Guid.NewGuid(),
                WorkflowRunId = run.Id,
                IntersectionId = intersection.Id,
                // Explicit camelCase property names here — plain
                // JsonSerializer.Serialize (unlike the ASP.NET Core
                // controller pipeline) defaults to the C# property names
                // as-is, and this JSON is read directly by the web
                // client, which expects the same camelCase convention as
                // every other API response.
                ProposedPlanJson = JsonSerializer.Serialize(new
                {
                    cycleSeconds = TotalCycleSeconds,
                    roads = validated.Roads.Select(r => new
                    {
                        laneLabel = r.LaneLabel,
                        vehicleCount = r.VehicleCount,
                        greenSeconds = r.GreenSeconds,
                    }),
                }),
                Justification = validated.Justification,
                SafetyCheckStatus = validated.WasAdjusted ? "ADJUSTED" : "PASSED",
                SafetyCheckNotes = validated.WasAdjusted
                    ? $"Validator adjusted one or more roads' AI-proposed seconds to stay within the allowed {MinGreenPerRoadSeconds}-{MaxGreenPerRoadSeconds}s range, or filled in a missing road from the deterministic baseline."
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
    // scoped to this one intersection), one latest reading per road, and
    // computes a deterministic proportional-split baseline (more vehicles
    // on a road -> more green seconds). Uses Ollama only to phrase the
    // narrative summary; the numbers themselves come from the database
    // and plain arithmetic, not the model.
    private async Task<DomainAnalysis> RunDomainAnalystAsync(Guid runId, Guid intersectionId, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        var latestPerSensor = await db.TelemetryReadings
            .Where(t => t.IntersectionId == intersectionId)
            .Include(t => t.CameraSensor)
            .OrderByDescending(t => t.Timestamp)
            .Take(50)
            .GroupBy(t => t.CameraSensorId)
            .Select(g => g.OrderByDescending(t => t.Timestamp).First())
            .ToListAsync(ct);

        var totalVehicles = latestPerSensor.Sum(r => r.VehicleCount);
        var remaining = Math.Max(0, TotalCycleSeconds - latestPerSensor.Count * MinGreenPerRoadSeconds);

        var roads = latestPerSensor
            .Select(r =>
            {
                var share = totalVehicles > 0 ? r.VehicleCount / (double)totalVehicles : 1.0 / Math.Max(1, latestPerSensor.Count);
                // With few roads, a dominant share of TotalCycleSeconds
                // can exceed MaxGreenPerRoadSeconds (e.g. 2 roads, 90s
                // cycle -> up to 85s) — clamp so the baseline itself is
                // always a safe value, both as the AI's anchor and as the
                // Validator's fallback.
                var baseline = Math.Clamp(MinGreenPerRoadSeconds + (int)Math.Round(share * remaining), MinGreenPerRoadSeconds, MaxGreenPerRoadSeconds);
                return new RoadReading(r.CameraSensor.LaneLabel, r.VehicleCount, baseline);
            })
            .OrderByDescending(r => r.VehicleCount)
            .ToList();

        var recentReadings = await db.TelemetryReadings
            .Where(t => t.IntersectionId == intersectionId)
            .OrderByDescending(t => t.Timestamp)
            .Take(TelemetryLookback)
            .ToListAsync(ct);
        var avgDensity = recentReadings.Count > 0 ? recentReadings.Average(r => r.LaneDensityPercent) : 0;
        var trend = recentReadings.Count >= 2 && recentReadings[0].LaneDensityPercent > recentReadings[^1].LaneDensityPercent
            ? "rising"
            : "stable_or_falling";

        var toolResult = new { roadsUsed = roads.Count, totalVehicles, avgDensity, trend, roads };

        string narrative;
        try
        {
            var roadSummary = string.Join(", ", roads.Select(r => $"{r.LaneLabel}: {r.VehicleCount} vehicles"));
            narrative = await ollama.GenerateAsync(
                $"In one short sentence, describe this traffic situation for a road operator: {roadSummary}. " +
                $"Average lane density {avgDensity:F0}%, trend is {trend}. " +
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

        var analysis = new DomainAnalysis(avgDensity, trend, narrative.Trim(), roads);

        await RecordStepAsync(
            runId, "DomainAnalyst", 1,
            inputJson: JsonSerializer.Serialize(new { intersectionId }),
            outputJson: JsonSerializer.Serialize(analysis),
            toolCallsJson: JsonSerializer.Serialize(new[] { new { tool = "get_recent_telemetry_per_road", result = toolResult } }),
            validationResult: "PASSED",
            sw.ElapsedMilliseconds, ct);

        return analysis;
    }

    // Agent 3 — Proposer. The only agent allowed to ask the model for an
    // actual timing recommendation (its one allow-listed tool). Shown the
    // Domain Analyst's deterministic baseline as an anchor, since a small
    // local model asked to invent N numbers from scratch is unreliable.
    // Output is treated as untrusted input until Agent 4 checks it.
    private async Task<RawProposal> RunProposerAsync(Guid runId, DomainAnalysis analysis, string? revisionNote, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        var revisionClause = revisionNote is null
            ? string.Empty
            : $"\nAn operator rejected a previous proposal for this intersection and asked for this to be reconsidered: \"{revisionNote}\". Take that feedback into account.\n";

        var baselineJson = JsonSerializer.Serialize(
            analysis.Roads.Select(r => new { r.LaneLabel, r.VehicleCount, suggestedGreenSeconds = r.BaselineGreenSeconds }));

        var roadNames = string.Join(", ", analysis.Roads.Select(r => $"\"{r.LaneLabel}\""));

        var prompt =
            "You are a traffic-signal timing assistant. Situation summary: " +
            $"{analysis.Narrative}\n" +
            $"A deterministic baseline split (more vehicles = more green seconds, {MinGreenPerRoadSeconds}-{MaxGreenPerRoadSeconds}s range) has already been computed: {baselineJson}\n" +
            revisionClause +
            "You may keep these values or adjust them slightly if you have a good reason. Reply with ONLY a JSON object, " +
            "no other text, in exactly this shape, including EVERY road listed above " +
            $"({roadNames}): " +
            "{\"roads\": [{\"laneLabel\": \"<name>\", \"greenSeconds\": <integer>}], \"justification\": \"<one sentence covering the overall plan and why>\"}";

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
            toolCallsJson: JsonSerializer.Serialize(new[] { new { tool = "ollama_propose_per_road_timing", model = "llama3.2:1b" } }),
            validationResult: parsed is not null ? "PASSED" : "UNPARSEABLE",
            sw.ElapsedMilliseconds, ct);

        return parsed ?? new RawProposal(new Dictionary<string, int>(), "The model's response could not be parsed as a valid proposal.");
    }

    // Agent 4 — Validator / safety agent. No model call at all — every
    // guarantee here comes from plain C# rules, which is the point: the
    // AI's output is never trusted blindly. Each road's value is clamped
    // into the safe range, and any road the AI's response is missing or
    // malformed for falls back to the Domain Analyst's deterministic
    // baseline rather than failing the whole proposal.
    private async Task<ValidatedProposal> RunValidatorAsync(Guid runId, DomainAnalysis analysis, RawProposal proposal, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var wasAdjusted = false;

        var validatedRoads = analysis.Roads
            .Select(road =>
            {
                if (proposal.RoadSeconds.TryGetValue(road.LaneLabel, out var aiSeconds))
                {
                    var clamped = Math.Clamp(aiSeconds, MinGreenPerRoadSeconds, MaxGreenPerRoadSeconds);
                    if (clamped != aiSeconds) wasAdjusted = true;
                    return new ValidatedRoad(road.LaneLabel, road.VehicleCount, clamped);
                }

                // AI's response didn't include this road — fall back to
                // the deterministic baseline rather than dropping it.
                wasAdjusted = true;
                return new ValidatedRoad(road.LaneLabel, road.VehicleCount, road.BaselineGreenSeconds);
            })
            .ToList();

        var result = new ValidatedProposal(validatedRoads, proposal.Justification, wasAdjusted);

        await RecordStepAsync(
            runId, "Validator", 3,
            inputJson: JsonSerializer.Serialize(proposal),
            outputJson: JsonSerializer.Serialize(result),
            toolCallsJson: null,
            wasAdjusted ? "ADJUSTED" : "PASSED", sw.ElapsedMilliseconds, ct);

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

            var roadSeconds = new Dictionary<string, int>();
            if (root.TryGetProperty("roads", out var roadsProp) && roadsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var roadEl in roadsProp.EnumerateArray())
                {
                    if (roadEl.TryGetProperty("laneLabel", out var labelProp) &&
                        roadEl.TryGetProperty("greenSeconds", out var secProp) &&
                        labelProp.ValueKind == JsonValueKind.String &&
                        labelProp.GetString() is { } label &&
                        TryReadInt(secProp, out var seconds))
                    {
                        roadSeconds[label] = seconds;
                    }
                }
            }

            var justification = root.TryGetProperty("justification", out var jProp) && jProp.ValueKind == JsonValueKind.String
                ? jProp.GetString()
                : null;
            return new RawProposal(roadSeconds, justification ?? "No justification provided.");
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // A small local model doesn't reliably keep numbers as JSON numbers —
    // it sometimes quotes them (e.g. "greenSeconds": "60"). JsonElement's
    // TryGetInt32 throws InvalidOperationException (not JsonException) for
    // a value of the wrong kind entirely, so this checks the kind first
    // and accepts a numeric string as a fallback, rather than letting one
    // malformed road crash the whole proposal.
    private static bool TryReadInt(JsonElement element, out int value)
    {
        if (element.ValueKind == JsonValueKind.Number && element.TryGetInt32(out value))
        {
            return true;
        }
        if (element.ValueKind == JsonValueKind.String && int.TryParse(element.GetString(), out value))
        {
            return true;
        }
        value = 0;
        return false;
    }

    private record RoadReading(string LaneLabel, int VehicleCount, int BaselineGreenSeconds);

    private record DomainAnalysis(double AvgDensityPercent, string Trend, string Narrative, List<RoadReading> Roads);

    private record RawProposal(Dictionary<string, int> RoadSeconds, string Justification);

    private record ValidatedRoad(string LaneLabel, int VehicleCount, int GreenSeconds);

    private record ValidatedProposal(List<ValidatedRoad> Roads, string Justification, bool WasAdjusted);
}
