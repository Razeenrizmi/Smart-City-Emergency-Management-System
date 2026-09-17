using Microsoft.EntityFrameworkCore;
using SRMS.API.Models;

namespace SRMS.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<EmergencySession> EmergencySessions { get; set; }
    public DbSet<TrafficRoute> Routes { get; set; }
    public DbSet<RouteJunction> RouteJunctions { get; set; }
    public DbSet<RoadJunction> RoadJunctions { get; set; }
    public DbSet<SignalPreemptionLog> SignalPreemptionLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure EmergencySession
        modelBuilder.Entity<EmergencySession>(entity =>
        {
            entity.HasKey(e => e.SessionId);
            
            entity.Property(e => e.SessionId)
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.DriverId)
                .IsRequired();

            entity.Property(e => e.VehicleType)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Status)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.SelectedRouteId)
                .IsRequired(false);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Relationship: Routes 1:N EmergencySessions
            entity.HasOne(e => e.SelectedRoute)
                .WithMany(r => r.EmergencySessions)
                .HasForeignKey(e => e.SelectedRouteId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_emergency_sessions_selected_route_id");
        });

        // Configure Route
        modelBuilder.Entity<TrafficRoute>(entity =>
        {
            entity.HasKey(e => e.RouteId);
            
            entity.Property(e => e.RouteId)
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.RouteName)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.StartLocation)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Destination)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.DistanceKm)
                .IsRequired()
                .HasColumnType("decimal(10,2)");

            entity.Property(e => e.EstimatedTimeMinutes)
                .IsRequired();

            entity.Property(e => e.TrafficLevel)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Relationship: Routes 1:N RouteJunctions
            entity.HasMany(r => r.RouteJunctions)
                .WithOne(rj => rj.Route)
                .HasForeignKey(rj => rj.RouteId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_route_junctions_route_id");
        });

        // Configure RouteJunction
        modelBuilder.Entity<RouteJunction>(entity =>
        {
            entity.HasKey(e => e.RouteJunctionId);
            
            entity.Property(e => e.RouteJunctionId)
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.RouteId)
                .IsRequired();

            entity.Property(e => e.JunctionId)
                .IsRequired();

            entity.Property(e => e.SequenceNumber)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Relationship: Routes 1:N RouteJunctions
            entity.HasOne(rj => rj.Route)
                .WithMany(r => r.RouteJunctions)
                .HasForeignKey(rj => rj.RouteId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_route_junctions_route_id");

            // Relationship: RoadJunctions 1:N RouteJunctions
            entity.HasOne(rj => rj.RoadJunction)
                .WithMany(rj => rj.RouteJunctions)
                .HasForeignKey(rj => rj.JunctionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_route_junctions_junction_id");

            // Unique constraint to ensure junction is only once per route
            entity.HasIndex(rj => new { rj.RouteId, rj.JunctionId })
                .IsUnique()
                .HasDatabaseName("uq_route_junctions_route_junction");
        });

        // Configure RoadJunction
        modelBuilder.Entity<RoadJunction>(entity =>
        {
            entity.HasKey(e => e.JunctionId);
            
            entity.Property(e => e.JunctionId)
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.JunctionName)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Latitude)
                .IsRequired()
                .HasColumnType("decimal(10,8)");

            entity.Property(e => e.Longitude)
                .IsRequired()
                .HasColumnType("decimal(11,8)");

            entity.Property(e => e.CurrentSignalState)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Relationship: RoadJunctions 1:N RouteJunctions
            entity.HasMany(rj => rj.RouteJunctions)
                .WithOne(rj => rj.RoadJunction)
                .HasForeignKey(rj => rj.JunctionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_route_junctions_junction_id");

            // Relationship: RoadJunctions 1:N SignalPreemptionLogs
            entity.HasMany(rj => rj.SignalPreemptionLogs)
                .WithOne(spl => spl.RoadJunction)
                .HasForeignKey(spl => spl.JunctionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_signal_preemption_logs_junction_id");
        });

        // Configure SignalPreemptionLog
        modelBuilder.Entity<SignalPreemptionLog>(entity =>
        {
            entity.HasKey(e => e.LogId);
            
            entity.Property(e => e.LogId)
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.SessionId)
                .IsRequired();

            entity.Property(e => e.JunctionId)
                .IsRequired();

            entity.Property(e => e.IsActive)
                .IsRequired();

            entity.Property(e => e.ActivatedAt)
                .IsRequired(false);

            entity.Property(e => e.DeactivatedAt)
                .IsRequired(false);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Relationship: EmergencySessions 1:N SignalPreemptionLogs
            entity.HasOne(spl => spl.EmergencySession)
                .WithMany(es => es.SignalPreemptionLogs)
                .HasForeignKey(spl => spl.SessionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_signal_preemption_logs_session_id");

            // Relationship: RoadJunctions 1:N SignalPreemptionLogs
            entity.HasOne(spl => spl.RoadJunction)
                .WithMany(rj => rj.SignalPreemptionLogs)
                .HasForeignKey(spl => spl.JunctionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_signal_preemption_logs_junction_id");
        });
    }
}
