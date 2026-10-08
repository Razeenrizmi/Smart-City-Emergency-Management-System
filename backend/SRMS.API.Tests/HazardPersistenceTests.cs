using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;
using SRMS.API.Tests.Support;
using Xunit;

namespace SRMS.API.Tests;

/// <summary>
/// Persistence tests for <see cref="RoadHazardReport"/> against a real
/// PostgreSQL database (EF Core + Npgsql), covering field round-tripping and
/// the officer approval lifecycle. Rows created here are tagged via ImageUrl
/// and removed in <see cref="DisposeAsync"/>.
/// </summary>
[Collection("HazardsDb")]
public sealed class HazardPersistenceTests : IAsyncLifetime
{
    private const string Marker = "hazard-persistence-test";
    private readonly AppDbContext _db;

    public HazardPersistenceTests(HazardDatabaseFixture fixture)
    {
        _db = TestDatabase.CreateContext(fixture.ConnectionString);
    }

    public async Task InitializeAsync() => await _db.Database.MigrateAsync();

    public async Task DisposeAsync()
    {
        await _db.RoadHazardReports
            .Where(h => h.ImageUrl == Marker)
            .ExecuteDeleteAsync();
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task Report_round_trips_all_fields()
    {
        var report = new RoadHazardReport
        {
            Latitude = 6.9271m,
            Longitude = 79.8850m,
            AccelerometerZSpike = 12.5m,
            HazardType = "POTHOLE",
            SeverityScore = 3,
            ImageUrl = Marker,
            ApprovalStatus = "PENDING",
        };

        _db.RoadHazardReports.Add(report);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var reloaded = await _db.RoadHazardReports.AsNoTracking()
            .SingleAsync(h => h.HazardId == report.HazardId);

        Assert.Equal(6.9271m, reloaded.Latitude);
        Assert.Equal(79.8850m, reloaded.Longitude);
        Assert.Equal(12.5m, reloaded.AccelerometerZSpike);
        Assert.Equal("POTHOLE", reloaded.HazardType);
        Assert.Equal(3, reloaded.SeverityScore);
        Assert.Equal("PENDING", reloaded.ApprovalStatus);
    }

    [Theory]
    [InlineData(90.0, 180.0)]
    [InlineData(-90.0, -180.0)]
    [InlineData(0.0, 0.0)]
    public async Task Gps_boundary_coordinates_are_persisted(double latitude, double longitude)
    {
        var report = new RoadHazardReport
        {
            Latitude = (decimal)latitude,
            Longitude = (decimal)longitude,
            AccelerometerZSpike = 5.0m,
            ImageUrl = Marker,
        };

        _db.RoadHazardReports.Add(report);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var reloaded = await _db.RoadHazardReports.AsNoTracking()
            .SingleAsync(h => h.HazardId == report.HazardId);

        Assert.Equal((decimal)latitude, reloaded.Latitude);
        Assert.Equal((decimal)longitude, reloaded.Longitude);
    }

    [Fact]
    public async Task Approval_status_transitions_are_persisted()
    {
        var report = new RoadHazardReport
        {
            Latitude = 6.9271m,
            Longitude = 79.8850m,
            AccelerometerZSpike = 15.0m,
            ImageUrl = Marker,
            ApprovalStatus = "PENDING",
        };

        _db.RoadHazardReports.Add(report);
        await _db.SaveChangesAsync();

        report.ApprovalStatus = "APPROVED";
        report.IsVerified = true;
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var approved = await _db.RoadHazardReports.AsNoTracking()
            .SingleAsync(h => h.HazardId == report.HazardId);
        Assert.Equal("APPROVED", approved.ApprovalStatus);
        Assert.True(approved.IsVerified);

        approved.ApprovalStatus = "RESOLVED";
        _db.Update(approved);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var resolved = await _db.RoadHazardReports.AsNoTracking()
            .SingleAsync(h => h.HazardId == report.HazardId);
        Assert.Equal("RESOLVED", resolved.ApprovalStatus);
    }
}
