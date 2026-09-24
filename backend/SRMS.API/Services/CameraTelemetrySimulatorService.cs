using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Services;

// Your task: "Writes IHostedService in C# to auto-insert simulated vehicle
// counts into junction_camera_telemetry every 30 seconds." The real schema
// calls this table TelemetryReadings (one row per CameraSensor per tick,
// each sensor belonging to an Intersection) — same job, real table names.
//
// BackgroundService implements IHostedService — the standard ASP.NET Core
// base class for a long-running background loop.
//
// Telemetry only — the Agentic AI workflow (SignalTimingAgentWorkflow) is
// deliberately NOT triggered from here. It only ever runs when an operator
// explicitly asks for it (the "Get AI signal timing plan" button), so
// every proposal in the system traces back to a real, demonstrable human
// action instead of appearing on its own from a random congestion roll.
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

        var intersections = await db.Intersections
            .Include(i => i.CameraSensors)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;

        foreach (var intersection in intersections)
        {
            if (intersection.CameraSensors.Count == 0) continue;

            foreach (var sensor in intersection.CameraSensors)
            {
                var vehicleCount = _random.Next(0, 30);
                // Density tracks vehicle count with a bit of independent
                // noise, rather than a pure random number, so a busy lane
                // reads as busy across both fields.
                var laneDensityPercent = Math.Clamp(vehicleCount * 3.2 + _random.Next(-10, 10), 0, 100);

                db.TelemetryReadings.Add(new TelemetryReading
                {
                    Id = Guid.NewGuid(),
                    CameraSensorId = sensor.Id,
                    IntersectionId = intersection.Id,
                    Timestamp = now,
                    VehicleCount = vehicleCount,
                    QueueLength = Math.Min(vehicleCount, _random.Next(0, 12)),
                    LaneDensityPercent = laneDensityPercent,
                });
            }

            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation(
            "Recorded telemetry for {Count} intersection(s) at {Time}", intersections.Count, now);
    }
}
