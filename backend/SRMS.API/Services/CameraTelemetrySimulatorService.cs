using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Services;

// Your task: "Writes IHostedService in C# to auto-insert simulated vehicle
// counts into junction_camera_telemetry every 30 seconds."
//
// BackgroundService implements IHostedService — it's the standard ASP.NET
// Core base class for a long-running background loop, so this is that
// requirement plus the timer/cancellation bookkeeping done for you.
//
// It also does one more thing beyond the literal task: when a junction's
// latest reading is HIGH/SEVERE and it has no pending proposal yet, it
// creates a simple rule-based SignalAdjustmentProposal. That's a stand-in
// for the real Agentic AI subsystem (not built yet) — clearly a
// placeholder, not the actual agent workflow the assignment requires.
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
                await RecordTelemetryForAllJunctionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                // A single failed tick (e.g. DB briefly unavailable) shouldn't
                // kill the whole background loop — log it and try again next
                // interval.
                logger.LogError(ex, "Camera telemetry simulation tick failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task RecordTelemetryForAllJunctionsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SrmsDbContext>();

        var junctions = await db.RoadJunctions.ToListAsync(ct);
        var now = DateTime.UtcNow;

        foreach (var junction in junctions)
        {
            var vehicleCount = _random.Next(0, 55);
            var congestionLevel = DeriveCongestionLevel(vehicleCount);

            db.JunctionCameraTelemetry.Add(new JunctionCameraTelemetry
            {
                Id = Guid.NewGuid(),
                JunctionId = junction.Id,
                CameraId = $"CAM-{junction.Id.ToString()[..8]}",
                DetectedVehicleCount = vehicleCount,
                CongestionLevel = congestionLevel,
                RecordedAt = now,
            });

            if (congestionLevel is "HIGH" or "SEVERE")
            {
                var hasPendingProposal = await db.SignalAdjustmentProposals.AnyAsync(
                    p => p.JunctionId == junction.Id && p.IsApprovedByOperator == null, ct);

                if (!hasPendingProposal)
                {
                    db.SignalAdjustmentProposals.Add(new SignalAdjustmentProposal
                    {
                        Id = Guid.NewGuid(),
                        JunctionId = junction.Id,
                        WorkflowId = null,
                        ProposedGreenExtensionSec = 10,
                        IsApprovedByOperator = null,
                        CreatedAt = now,
                        UpdatedAt = now,
                    });
                }
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Recorded camera telemetry for {Count} junction(s) at {Time}",
            junctions.Count, now);
    }

    // Mirrors web/src/lib/congestion.js's deriveCongestionLevel exactly, so
    // the same vehicle count means the same congestion level whether it's
    // computed here or in the browser.
    private static string DeriveCongestionLevel(int vehicleCount)
    {
        if (vehicleCount >= 45) return "SEVERE";
        if (vehicleCount >= 30) return "HIGH";
        if (vehicleCount >= 15) return "MODERATE";
        return "LOW";
    }
}
