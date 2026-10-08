using Microsoft.AspNetCore.Mvc;
using SRMS.API.Controllers;
using SRMS.API.Models;
using SRMS.API.Tests.Support;
using Xunit;

namespace SRMS.API.Tests;

/// <summary>
/// Backend unit tests for <see cref="HazardsController"/> using Moq to fake the
/// EF context — covers the accelerometer-spike severity mapping and the hazard
/// approval state transitions without touching a database.
/// </summary>
public sealed class HazardDetectionTests
{
    // ── Normal + boundary: spike → severity (rubric thresholds) ──────────────
    [Theory]
    [InlineData(18.0, 5)]
    [InlineData(17.9, 4)]
    [InlineData(14.0, 4)]
    [InlineData(13.9, 3)]
    [InlineData(10.0, 3)]
    [InlineData(9.9, 2)]
    [InlineData(7.0, 2)]
    [InlineData(6.9, 1)]
    [InlineData(12.5, 3)] // normal case
    [InlineData(0.0, 1)]  // low bound
    public async Task CreateReport_maps_spike_to_severity(double spike, int expectedSeverity)
    {
        var (context, store) = MockDbContextFactory.Create();
        var controller = new HazardsController(context.Object);
        var report = new RoadHazardReport
        {
            Latitude = 6.9271m,
            Longitude = 79.8850m,
            AccelerometerZSpike = (decimal)spike,
        };

        var result = await controller.CreateReport(report);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(expectedSeverity, report.SeverityScore);
        Assert.Single(store);
    }

    [Fact]
    public async Task CreateReport_defaults_to_pending_and_unverified()
    {
        var (context, _) = MockDbContextFactory.Create();
        var controller = new HazardsController(context.Object);
        var report = new RoadHazardReport
        {
            Latitude = 6.9271m,
            Longitude = 79.8850m,
            AccelerometerZSpike = 12.5m,
        };

        await controller.CreateReport(report);

        Assert.Equal("PENDING", report.ApprovalStatus);
        Assert.False(report.IsVerified);
    }

    // ── Invalid: no GPS fix ──────────────────────────────────────────────────
    [Fact]
    public async Task CreateReport_without_coordinates_returns_bad_request()
    {
        var (context, store) = MockDbContextFactory.Create();
        var controller = new HazardsController(context.Object);
        var report = new RoadHazardReport { AccelerometerZSpike = 12.5m }; // lat/lng default to 0

        var result = await controller.CreateReport(report);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(store);
    }

    // ── Approve / reject state transitions ───────────────────────────────────
    [Fact]
    public async Task Approve_marks_hazard_approved_and_verified()
    {
        var hazard = new RoadHazardReport { Latitude = 6.9m, Longitude = 79.8m, ApprovalStatus = "PENDING" };
        var (context, _) = MockDbContextFactory.Create(new[] { hazard });
        var controller = new HazardsController(context.Object);

        var result = await controller.Approve(hazard.HazardId);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("APPROVED", hazard.ApprovalStatus);
        Assert.True(hazard.IsVerified);
    }

    [Fact]
    public async Task Approve_non_pending_hazard_returns_bad_request()
    {
        var hazard = new RoadHazardReport { Latitude = 6.9m, Longitude = 79.8m, ApprovalStatus = "APPROVED" };
        var (context, _) = MockDbContextFactory.Create(new[] { hazard });
        var controller = new HazardsController(context.Object);

        var result = await controller.Approve(hazard.HazardId);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Reject_marks_hazard_rejected()
    {
        var hazard = new RoadHazardReport { Latitude = 6.9m, Longitude = 79.8m, ApprovalStatus = "PENDING" };
        var (context, _) = MockDbContextFactory.Create(new[] { hazard });
        var controller = new HazardsController(context.Object);

        var result = await controller.Reject(hazard.HazardId);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("REJECTED", hazard.ApprovalStatus);
        Assert.False(hazard.IsVerified);
    }

    // ── Failure: unknown hazard ──────────────────────────────────────────────
    [Fact]
    public async Task Approve_unknown_id_returns_not_found()
    {
        var (context, _) = MockDbContextFactory.Create();
        var controller = new HazardsController(context.Object);

        var result = await controller.Approve(Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Reject_unknown_id_returns_not_found()
    {
        var (context, _) = MockDbContextFactory.Create();
        var controller = new HazardsController(context.Object);

        var result = await controller.Reject(Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
