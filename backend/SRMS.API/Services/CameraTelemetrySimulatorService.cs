using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;
using SRMS.API.Services.Agents;
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
// When an intersection's average lane density goes HIGH/SEVERE and it
// doesn't already have a proposal awaiting a decision, this runs your
// actual Agentic AI contribution (SignalTimingAgentWorkflow) — a real
// 4-agent plan → analyze → propose → validate pipeline, not the earlier
// rule-based placeholder.
public class CameraTelemetrySimulatorService(
    IServiceScopeFactory scopeFactory,
    ILogger<CameraTelemetrySimulatorService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);
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
        // Resolved from the same scope as `db` — the agent workflow shares
        // this exact DbContext instance, so the telemetry rows it reads
        // back for its analysis are the ones just written below, not a
        // stale snapshot from a different connection.
        var agentWorkflow = scope.ServiceProvider.GetRequiredService<SignalTimingAgentWorkflow>();

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

            // Commit this intersection's readings now — the agent
            // workflow below queries TelemetryReadings fresh, so it needs
            // to actually see what was just recorded, not a snapshot from
            // before this tick started.
            await db.SaveChangesAsync(ct);

            if (congestionLevel is "HIGH" or "SEVERE")
            {
                var hasPendingProposal = await db.SignalTimingProposals
                    .Where(p => p.IntersectionId == intersection.Id)
                    .AnyAsync(p => p.SignalTimingDecision == null, ct);

                if (!hasPendingProposal)
                {
                    await agentWorkflow.RunAsync(intersection, ct: ct);
                }
            }
        }

        logger.LogInformation(
            "Recorded telemetry for {Count} intersection(s) at {Time}", intersections.Count, now);
    }
}
