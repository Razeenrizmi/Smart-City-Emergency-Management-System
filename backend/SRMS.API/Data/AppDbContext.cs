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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<HotlistVehicle>().ToTable("vehicle");
        modelBuilder.Entity<Camera>().HasIndex(c => c.CameraId).IsUnique();
        modelBuilder.Entity<HotlistVehicle>().HasIndex(h => h.VehicleId).IsUnique();
        modelBuilder.Entity<DetectionLog>().HasIndex(d => d.LogId).IsUnique();
        modelBuilder.Entity<PatrolUnit>().HasIndex(p => p.UnitId).IsUnique();

        modelBuilder.Entity<Camera>().HasData(
            new Camera { Id = 1, CameraId = "CAM-101", Name = "Main St & 5th Ave Intersection", Zone = "Downtown Central", Status = "Alert", Lat = 35, Lng = 42, Resolution = "4K HDR ANPR", Fps = 60, ScannedToday = 3840, LastPlate = "WP CAD-7829", LastScanTime = "10s ago" },
            new Camera { Id = 2, CameraId = "CAM-102", Name = "West Highway Tollgate 4", Zone = "Western Corridor", Status = "Active", Lat = 20, Lng = 22, Resolution = "1080p IR NightVision", Fps = 30, ScannedToday = 5120, LastPlate = "CB-8821", LastScanTime = "2s ago" },
            new Camera { Id = 3, CameraId = "CAM-103", Name = "Metro City Bridge North Gate", Zone = "Northern Suburbs", Status = "Active", Lat = 68, Lng = 65, Resolution = "4K Multi-Lane OCR", Fps = 60, ScannedToday = 4290, LastPlate = "KAP-3091", LastScanTime = "5s ago" },
            new Camera { Id = 4, CameraId = "CAM-104", Name = "Financial District Plaza South", Zone = "Financial Quarter", Status = "Alert", Lat = 48, Lng = 78, Resolution = "4K Ultra High Speed ANPR", Fps = 120, ScannedToday = 2980, LastPlate = "SP BC-4410", LastScanTime = "1m ago" },
            new Camera { Id = 5, CameraId = "CAM-105", Name = "Airport Expressway Km 14", Zone = "Eastern Highway", Status = "Active", Lat = 80, Lng = 30, Resolution = "1080p Long Range Lens", Fps = 60, ScannedToday = 6410, LastPlate = "WP GZ-9901", LastScanTime = "12s ago" },
            new Camera { Id = 6, CameraId = "CAM-106", Name = "Harbor Commercial Docks Entrance", Zone = "Industrial Port", Status = "Maintenance", Lat = 15, Lng = 85, Resolution = "1080p Thermal + ANPR", Fps = 30, ScannedToday = 810, LastPlate = "TRK-5512", LastScanTime = "15m ago" }
        );

        modelBuilder.Entity<HotlistVehicle>().HasData(
            new HotlistVehicle { Id = 1, VehicleId = "HV-1001", PlateNumber = "WP CAD-7829", MakeModel = "Toyota Land Cruiser V8", Color = "Obsidian Black", ThreatLevel = "CRITICAL", IncidentType = "Armed Bank Robbery & Kidnapping", WantedSince = "2026-09-10 14:30", LastSeenCamera = "CAM-101 (Main St & 5th Ave)", OwnerName = "Suspect Alias: \"Viper\"", Status = "WANTED", Notes = "Occupants armed with automatic rifles. Intercept only with SWAT / Tactical cover.", Image = "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80" },
            new HotlistVehicle { Id = 2, VehicleId = "HV-1002", PlateNumber = "SP BC-4410", MakeModel = "BMW 5 Series Sedan", Color = "Silver Metallic", ThreatLevel = "HIGH", IncidentType = "Hit & Run Pedestrian Casualty", WantedSince = "2026-09-11 08:15", LastSeenCamera = "CAM-104 (Financial Plaza)", OwnerName = "Registered: Marcus Vance", Status = "WANTED", Notes = "Front bumper heavily damaged on left side. Driver fleeing central district.", Image = "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80" },
            new HotlistVehicle { Id = 3, VehicleId = "HV-1003", PlateNumber = "WP GZ-9901", MakeModel = "Ford Transit Cargo Van", Color = "Matte White", ThreatLevel = "HIGH", IncidentType = "Illegal Contraband Smuggling", WantedSince = "2026-09-09 21:00", LastSeenCamera = "CAM-105 (Airport Exp Km 14)", OwnerName = "Apex Transport LLC (Fictitious)", Status = "SEARCHING", Notes = "Fake business logos on side panel. Suspected transport of stolen electronics.", Image = "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80" },
            new HotlistVehicle { Id = 4, VehicleId = "HV-1004", PlateNumber = "CP KY-1290", MakeModel = "Dodge Charger SRT", Color = "Crimson Red", ThreatLevel = "MEDIUM", IncidentType = "Reckless Street Racing & Evading Arrest", WantedSince = "2026-09-11 01:45", LastSeenCamera = "CAM-102 (West Tollgate)", OwnerName = "Registered: Julian Croft", Status = "INTERCEPTED", Notes = "Vehicle impounded at Sector 3 impound lot. Suspect detained.", Image = "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=600&q=80" }
        );

        modelBuilder.Entity<DetectionLog>().HasData(
            new DetectionLog { Id = 1, LogId = "LOG-98401", Timestamp = "2026-09-11 13:51:02", PlateNumber = "WP CAD-7829", CameraId = "CAM-101", CameraName = "Main St & 5th Ave Intersection", Location = "Downtown Central - Sector 1", Confidence = 99.2, Speed = "82 km/h", Direction = "Northbound", IsHotlistMatch = true, ThreatLevel = "CRITICAL", VehicleDetails = "Toyota Land Cruiser (Obsidian Black)", Status = "ALERT_TRIGGERED", Snapshot = "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80" },
            new DetectionLog { Id = 2, LogId = "LOG-98400", Timestamp = "2026-09-11 13:48:30", PlateNumber = "SP BC-4410", CameraId = "CAM-104", CameraName = "Financial District Plaza South", Location = "Financial Quarter - Sector 4", Confidence = 97.6, Speed = "65 km/h", Direction = "Eastbound", IsHotlistMatch = true, ThreatLevel = "HIGH", VehicleDetails = "BMW 5 Series (Silver Metallic)", Status = "DISPATCHED", Snapshot = "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80" },
            new DetectionLog { Id = 3, LogId = "LOG-98399", Timestamp = "2026-09-11 13:45:12", PlateNumber = "WP GZ-9901", CameraId = "CAM-105", CameraName = "Airport Expressway Km 14", Location = "Eastern Highway - Sector 7", Confidence = 98.8, Speed = "110 km/h", Direction = "Outbound", IsHotlistMatch = true, ThreatLevel = "HIGH", VehicleDetails = "Ford Transit Van (Matte White)", Status = "ALERT_TRIGGERED", Snapshot = "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80" },
            new DetectionLog { Id = 4, LogId = "LOG-98398", Timestamp = "2026-09-11 13:42:00", PlateNumber = "CB-8821", CameraId = "CAM-102", CameraName = "West Highway Tollgate 4", Location = "Western Corridor - Gate 4", Confidence = 99.8, Speed = "45 km/h", Direction = "Inbound", IsHotlistMatch = false, ThreatLevel = "CLEAR", VehicleDetails = "Honda Civic Sedan (Gray)", Status = "CLEARED", Snapshot = "https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=600&q=80" },
            new DetectionLog { Id = 5, LogId = "LOG-98397", Timestamp = "2026-09-11 13:40:18", PlateNumber = "KAP-3091", CameraId = "CAM-103", CameraName = "Metro City Bridge North Gate", Location = "Northern Suburbs - Bridge Gate", Confidence = 96.4, Speed = "58 km/h", Direction = "Southbound", IsHotlistMatch = false, ThreatLevel = "CLEAR", VehicleDetails = "Nissan X-Trail SUV (Blue)", Status = "CLEARED", Snapshot = "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=600&q=80" }
        );

        modelBuilder.Entity<PatrolUnit>().HasData(
            new PatrolUnit { Id = 1, UnitId = "UNIT-402", Callsign = "Patrol Alpha 4", LeadOfficer = "Sgt. Miller & Off. Davis", Sector = "Downtown Central", Status = "AVAILABLE", VehicleType = "High-Speed Interceptor Utility", DistanceToAlert = "1.2 km", Eta = "2 mins" },
            new PatrolUnit { Id = 2, UnitId = "UNIT-308", Callsign = "Tactical Bravo 2", LeadOfficer = "Capt. Reynolds (SWAT)", Sector = "Financial District", Status = "EN_ROUTE", VehicleType = "Armored Tactical Response Unit", DistanceToAlert = "2.8 km", Eta = "4 mins" },
            new PatrolUnit { Id = 3, UnitId = "UNIT-512", Callsign = "Highway Patrol Delta 9", LeadOfficer = "Off. Chen", Sector = "Western Highway Corridor", Status = "AVAILABLE", VehicleType = "Dodge Pursuit Cruiser", DistanceToAlert = "4.5 km", Eta = "6 mins" },
            new PatrolUnit { Id = 4, UnitId = "UNIT-105", Callsign = "Air Surveillance Recon 1", LeadOfficer = "Pilot Vance", Sector = "City-Wide Aerial", Status = "ON_PATROL", VehicleType = "Eurocopter Emergency Drone/Chopper", DistanceToAlert = "0.8 km", Eta = "1 min" }
        );
    }
}
