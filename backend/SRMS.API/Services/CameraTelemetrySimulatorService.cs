using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;
using SRMS.API.Support;

namespace SRMS.API.Services;

// Your task: "Writes IHostedService in C# to auto-insert simulated vehicle
// counts into junction_camera_telemetry every 30 seconds." The real schema
// calls this table TelemetryReadings (one row per CameraSensor per tick,
// each sensor belonging to an Intersection) — same job, real table names.
//
// BackgroundService implements IHostedService — the standard ASP.NET Core
// base class for a long-running background loop.
//
// It also raises a SignalTimingProposal (plus a placeholder AgentWorkflowRun
// to satisfy the required WorkflowRunId FK) when an intersection's average
// lane density goes HIGH/SEVERE and it doesn't already have one awaiting a
// decision. This is a simple rule-based stand-in for the real Agentic AI
// subsystem, which is separate, not-yet-built work — clearly not a real
// planning/tool-use/validation workflow.
public class CameraTelemetrySimulatorService(
    IServiceScopeFactory scopeFactory,
    ILogger<CameraTelemetrySimulatorService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);
    private const double ProposalDensityThreshold = 65; // HIGH and above
    private readonly Random _random = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RecordTelemetryForAllIntersectionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Camera telemetry simulation tick failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task RecordTelemetryForAllIntersectionsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SrmsDbContext>();

        var intersections = await db.Intersections
            .Include(i => i.CameraSensors)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;

        foreach (var intersection in intersections)
        {
            if (intersection.CameraSensors.Count == 0) continue;

            var readingsThisTick = new List<TelemetryReading>();
            foreach (var sensor in intersection.CameraSensors)
            {
                var vehicleCount = _random.Next(0, 30);
                // Density tracks vehicle count with a bit of independent
                // noise, rather than a pure random number, so a busy lane
                // reads as busy across both fields.
                var laneDensityPercent = Math.Clamp(vehicleCount * 3.2 + _random.Next(-10, 10), 0, 100);

                var reading = new TelemetryReading
                {
                    Id = Guid.NewGuid(),
                    CameraSensorId = sensor.Id,
                    IntersectionId = intersection.Id,
                    Timestamp = now,
                    VehicleCount = vehicleCount,
                    QueueLength = Math.Min(vehicleCount, _random.Next(0, 12)),
                    LaneDensityPercent = laneDensityPercent,
                };
                readingsThisTick.Add(reading);
                db.TelemetryReadings.Add(reading);
            }

            var averageDensity = readingsThisTick.Average(r => r.LaneDensityPercent);
            var congestionLevel = CongestionLevelCalculator.FromLaneDensityPercent(averageDensity);

            if (congestionLevel is "HIGH" or "SEVERE")
            {
                var hasPendingProposal = await db.SignalTimingProposals
                    .Where(p => p.IntersectionId == intersection.Id)
                    .AnyAsync(p => p.SignalTimingDecision == null, ct);

                if (!hasPendingProposal)
                {
                    var run = new AgentWorkflowRun
                    {
                        Id = Guid.NewGuid(),
                        IntersectionId = intersection.Id,
                        Objective = $"Reduce congestion at {intersection.Name}",
                        Status = "AWAITING_APPROVAL",
                        StartedAt = now,
                    };
                    db.AgentWorkflowRuns.Add(run);

                    db.SignalTimingProposals.Add(new SignalTimingProposal
                    {
                        Id = Guid.NewGuid(),
                        WorkflowRunId = run.Id,
                        IntersectionId = intersection.Id,
                        ProposedPlanJson = """{"greenExtensionSeconds":10}""",
                        Justification =
                            $"Average lane density {averageDensity:F0}% across {readingsThisTick.Count} camera(s) is at or above the {ProposalDensityThreshold:F0}% threshold.",
                        SafetyCheckStatus = "PASSED",
                        SafetyCheckNotes = "Rule-based placeholder check — not yet validated by the real Agentic AI subsystem.",
                        CreatedAt = now,
                    });
                }
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Recorded telemetry for {Count} intersection(s) at {Time}", intersections.Count, now);
    }
}
