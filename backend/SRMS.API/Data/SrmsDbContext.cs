using Microsoft.EntityFrameworkCore;
using SRMS.API.Models;

namespace SRMS.API.Data;

public class SrmsDbContext(DbContextOptions<SrmsDbContext> options) : DbContext(options)
{
    public DbSet<RoadJunction> RoadJunctions => Set<RoadJunction>();
    public DbSet<JunctionCameraTelemetry> JunctionCameraTelemetry => Set<JunctionCameraTelemetry>();
    public DbSet<AiWorkflowExecution> AiWorkflowExecutions => Set<AiWorkflowExecution>();
    public DbSet<SignalAdjustmentProposal> SignalAdjustmentProposals => Set<SignalAdjustmentProposal>();

    // Column/table names below match the team's shared ER diagram exactly
    // (snake_case), since PostgreSQL is the shared database everyone's
    // backend reads and writes.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RoadJunction>(e =>
        {
            e.ToTable("road_junctions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("junction_id");
            e.Property(x => x.JunctionName).HasColumnName("junction_name").HasMaxLength(200).IsRequired();
            e.Property(x => x.Latitude).HasColumnName("latitude").HasPrecision(9, 6);
            e.Property(x => x.Longitude).HasColumnName("longitude").HasPrecision(9, 6);
            e.Property(x => x.CurrentSignalState).HasColumnName("current_signal_state").HasMaxLength(20);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<JunctionCameraTelemetry>(e =>
        {
            e.ToTable("junction_camera_telemetry");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("telemetry_id");
            e.Property(x => x.JunctionId).HasColumnName("junction_id");
            e.Property(x => x.CameraId).HasColumnName("camera_id").HasMaxLength(100).IsRequired();
            e.Property(x => x.DetectedVehicleCount).HasColumnName("detected_vehicle_count");
            e.Property(x => x.CongestionLevel).HasColumnName("congestion_level").HasMaxLength(20);
            e.Property(x => x.RecordedAt).HasColumnName("recorded_at");
            e.HasOne(x => x.Junction)
                .WithMany(x => x.TelemetryReadings)
                .HasForeignKey(x => x.JunctionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.JunctionId, x.RecordedAt });
        });

        modelBuilder.Entity<AiWorkflowExecution>(e =>
        {
            e.ToTable("ai_workflow_executions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("workflow_id");
            e.Property(x => x.DomainObjective).HasColumnName("domain_objective").HasMaxLength(500).IsRequired();
            e.Property(x => x.ExecutionPlan).HasColumnName("execution_plan").HasColumnType("jsonb");
            e.Property(x => x.ApprovalStatus).HasColumnName("approval_status").HasMaxLength(20);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<SignalAdjustmentProposal>(e =>
        {
            e.ToTable("signal_adjustment_proposals");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("proposal_id");
            e.Property(x => x.JunctionId).HasColumnName("junction_id");
            e.Property(x => x.WorkflowId).HasColumnName("workflow_id");
            e.Property(x => x.ProposedGreenExtensionSec).HasColumnName("proposed_green_extension_sec");
            e.Property(x => x.IsApprovedByOperator).HasColumnName("is_approved_by_operator");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasOne(x => x.Junction)
                .WithMany(x => x.Proposals)
                .HasForeignKey(x => x.JunctionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.JunctionId, x.IsApprovedByOperator });
        });
    }
}
