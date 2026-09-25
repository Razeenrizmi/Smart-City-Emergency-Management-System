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
    public DbSet<AiWorkflowExecution> AiWorkflowExecutions { get; set; }

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

            // Seed data for Routes
            var routeAId = Guid.Parse("22222222-2222-2222-2222-222222222201");
            var routeBId = Guid.Parse("22222222-2222-2222-2222-222222222202");
            var routeCId = Guid.Parse("22222222-2222-2222-2222-222222222203");

            entity.HasData(
                new TrafficRoute
                {
                    RouteId = routeAId,
                    RouteName = "Route A",
                    StartLocation = "Peradeniya",
                    Destination = "Kandy",
                    DistanceKm = 5.00m,
                    EstimatedTimeMinutes = 15,
                    TrafficLevel = "HIGH",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new TrafficRoute
                {
                    RouteId = routeBId,
                    RouteName = "Route B",
                    StartLocation = "Peradeniya",
                    Destination = "Kandy",
                    DistanceKm = 6.00m,
                    EstimatedTimeMinutes = 8,
                    TrafficLevel = "LOW",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new TrafficRoute
                {
                    RouteId = routeCId,
                    RouteName = "Route C",
                    StartLocation = "Peradeniya",
                    Destination = "Kandy",
                    DistanceKm = 7.00m,
                    EstimatedTimeMinutes = 11,
                    TrafficLevel = "MEDIUM",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
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

            // Seed data for RouteJunctions
            var j01Id = Guid.Parse("11111111-1111-1111-1111-111111111101");
            var j02Id = Guid.Parse("11111111-1111-1111-1111-111111111102");
            var j03Id = Guid.Parse("11111111-1111-1111-1111-111111111103");
            var j04Id = Guid.Parse("11111111-1111-1111-1111-111111111104");
            var j05Id = Guid.Parse("11111111-1111-1111-1111-111111111105");

            var routeAId = Guid.Parse("22222222-2222-2222-2222-222222222201");
            var routeBId = Guid.Parse("22222222-2222-2222-2222-222222222202");
            var routeCId = Guid.Parse("22222222-2222-2222-2222-222222222203");

            entity.HasData(
                // Route A: J01 → J02 → J04 → J05
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333301"),
                    RouteId = routeAId,
                    JunctionId = j01Id,
                    SequenceNumber = 1,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333302"),
                    RouteId = routeAId,
                    JunctionId = j02Id,
                    SequenceNumber = 2,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333303"),
                    RouteId = routeAId,
                    JunctionId = j04Id,
                    SequenceNumber = 3,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333304"),
                    RouteId = routeAId,
                    JunctionId = j05Id,
                    SequenceNumber = 4,
                    CreatedAt = DateTime.UtcNow
                },
                // Route B: J01 → J02 → J03 (REQUIRED)
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333305"),
                    RouteId = routeBId,
                    JunctionId = j01Id,
                    SequenceNumber = 1,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333306"),
                    RouteId = routeBId,
                    JunctionId = j02Id,
                    SequenceNumber = 2,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333307"),
                    RouteId = routeBId,
                    JunctionId = j03Id,
                    SequenceNumber = 3,
                    CreatedAt = DateTime.UtcNow
                },
                // Route C: J01 → J03 → J04 → J05
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333308"),
                    RouteId = routeCId,
                    JunctionId = j01Id,
                    SequenceNumber = 1,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333309"),
                    RouteId = routeCId,
                    JunctionId = j03Id,
                    SequenceNumber = 2,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333310"),
                    RouteId = routeCId,
                    JunctionId = j04Id,
                    SequenceNumber = 3,
                    CreatedAt = DateTime.UtcNow
                },
                new RouteJunction
                {
                    RouteJunctionId = Guid.Parse("33333333-3333-3333-3333-333333333311"),
                    RouteId = routeCId,
                    JunctionId = j05Id,
                    SequenceNumber = 4,
                    CreatedAt = DateTime.UtcNow
                }
            );
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

            // Seed data for RoadJunctions
            entity.HasData(
                new RoadJunction
                {
                    JunctionId = Guid.Parse("11111111-1111-1111-1111-111111111101"),
                    JunctionName = "Peradeniya Junction",
                    Latitude = 7.2580m,
                    Longitude = 80.5710m,
                    CurrentSignalState = "RED",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new RoadJunction
                {
                    JunctionId = Guid.Parse("11111111-1111-1111-1111-111111111102"),
                    JunctionName = "Gatambe Junction",
                    Latitude = 7.2650m,
                    Longitude = 80.5780m,
                    CurrentSignalState = "RED",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new RoadJunction
                {
                    JunctionId = Guid.Parse("11111111-1111-1111-1111-111111111103"),
                    JunctionName = "Hospital Junction",
                    Latitude = 7.2720m,
                    Longitude = 80.5850m,
                    CurrentSignalState = "GREEN",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new RoadJunction
                {
                    JunctionId = Guid.Parse("11111111-1111-1111-1111-111111111104"),
                    JunctionName = "Town Junction",
                    Latitude = 7.2790m,
                    Longitude = 80.5920m,
                    CurrentSignalState = "RED",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new RoadJunction
                {
                    JunctionId = Guid.Parse("11111111-1111-1111-1111-111111111105"),
                    JunctionName = "Lake Junction",
                    Latitude = 7.2860m,
                    Longitude = 80.5990m,
                    CurrentSignalState = "RED",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
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

            entity.Property(e => e.PreviousSignalState)
                .HasMaxLength(50);

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

        modelBuilder.Entity<AiWorkflowExecution>(entity =>
        {
            entity.HasKey(e => e.WorkflowId);

            entity.Property(e => e.WorkflowId)
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.SessionId)
                .IsRequired();

            entity.Property(e => e.ThreadId)
                .HasMaxLength(200);

            entity.Property(e => e.ProposalId)
                .HasMaxLength(100);

            entity.Property(e => e.Objective)
                .IsRequired()
                .HasMaxLength(300);

            entity.Property(e => e.CurrentStage)
                .HasMaxLength(100);

            entity.Property(e => e.WorkflowStatus)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.ProposalStatus)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.ApprovalStatus)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.ErrorSummary)
                .HasMaxLength(500);

            entity.Property(e => e.ApprovedBy)
                .HasMaxLength(200);

            entity.Property(e => e.ApprovalNotes)
                .HasMaxLength(500);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasIndex(e => e.SessionId)
                .IsUnique()
                .HasDatabaseName("uq_ai_workflow_executions_session_id");

            entity.HasOne(e => e.EmergencySession)
                .WithMany(s => s.AiWorkflowExecutions)
                .HasForeignKey(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_ai_workflow_executions_session_id");
        });
    }
}
