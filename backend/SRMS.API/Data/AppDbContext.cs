using Microsoft.EntityFrameworkCore;
using SRMS.API.Models;

namespace SRMS.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Camera> Cameras => Set<Camera>();
    public DbSet<HotlistVehicle> HotlistVehicles => Set<HotlistVehicle>();
    public DbSet<DetectionLog> DetectionLogs => Set<DetectionLog>();
    public DbSet<PatrolUnit> PatrolUnits => Set<PatrolUnit>();
    public DbSet<CctvNode> CctvNodes => Set<CctvNode>();
    public DbSet<DetectionSession> DetectionSessions => Set<DetectionSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<HotlistVehicle>().ToTable("vehicle");
        modelBuilder.Entity<Camera>().HasIndex(c => c.CameraId).IsUnique();
        modelBuilder.Entity<HotlistVehicle>().HasIndex(h => h.VehicleId).IsUnique();
        modelBuilder.Entity<DetectionLog>().HasIndex(d => d.LogId).IsUnique();
        modelBuilder.Entity<PatrolUnit>().HasIndex(p => p.UnitId).IsUnique();

        // Multi-CCTV: one row per node; duplicate protection = nodeId + sessionId + trackId
        modelBuilder.Entity<CctvNode>().HasIndex(n => n.NodeId).IsUnique();
        modelBuilder.Entity<DetectionSession>().HasIndex(s => s.SessionId).IsUnique();
        modelBuilder.Entity<DetectionLog>().HasIndex(d => new { d.NodeId, d.SessionId, d.TrackId }).IsUnique();

        modelBuilder.Entity<Camera>().HasData(
            new Camera { Id = 1, CameraId = "CAM-101", Name = "Main St & 5th Ave Intersection", Zone = "Downtown Central", Status = "Active", Lat = 6.9271, Lng = 79.8612, Resolution = "4K HDR ANPR", Fps = 60, ScannedToday = 0, LastPlate = "", LastScanTime = "Never" }
        );

        // University-project CCTV nodes — simulated nodes, both OFFLINE until the operator starts them.
        modelBuilder.Entity<CctvNode>().HasData(
            new CctvNode
            {
                Id = 1, NodeId = 1,
                CameraName = "Main Street CCTV",
                Location = "Main St & 5th Ave (University Simulated Node)",
                CameraType = "LAPTOP_WEBCAM", Status = "OFFLINE",
                StreamSource = "LOCAL_WEBCAM", StreamUrl = "",
                CreatedAt = "2026-01-01 00:00:00", LastSeenAt = "Never",
                Lat = 6.9271, Lng = 79.8612
            },
            new CctvNode
            {
                Id = 2, NodeId = 2,
                CameraName = "University Gate CCTV",
                Location = "University Main Gate (University Simulated Node)",
                CameraType = "MOBILE_CAMERA", Status = "OFFLINE",
                StreamSource = "PHONE_CAMERA", StreamUrl = "",
                CreatedAt = "2026-01-01 00:00:00", LastSeenAt = "Never",
                Lat = 6.9175, Lng = 79.8830
            }
        );

        modelBuilder.Entity<PatrolUnit>().HasData(
            new PatrolUnit { Id = 1, UnitId = "UNIT-402", Callsign = "Patrol Alpha 4", LeadOfficer = "Sgt. Miller & Off. Davis", Sector = "Downtown Central", Status = "AVAILABLE", VehicleType = "High-Speed Interceptor Utility", DistanceToAlert = "1.2 km", Eta = "2 mins" },
            new PatrolUnit { Id = 2, UnitId = "UNIT-308", Callsign = "Tactical Bravo 2", LeadOfficer = "Capt. Reynolds (SWAT)", Sector = "Financial District", Status = "AVAILABLE", VehicleType = "Armored Tactical Response Unit", DistanceToAlert = "2.8 km", Eta = "4 mins" },
            new PatrolUnit { Id = 3, UnitId = "UNIT-512", Callsign = "Highway Patrol Delta 9", LeadOfficer = "Off. Chen", Sector = "Western Highway Corridor", Status = "AVAILABLE", VehicleType = "Dodge Pursuit Cruiser", DistanceToAlert = "4.5 km", Eta = "6 mins" },
            new PatrolUnit { Id = 4, UnitId = "UNIT-105", Callsign = "Air Surveillance Recon 1", LeadOfficer = "Pilot Vance", Sector = "City-Wide Aerial", Status = "ON_PATROL", VehicleType = "Eurocopter Emergency Drone/Chopper", DistanceToAlert = "0.8 km", Eta = "1 min" }
        );
    }
}
