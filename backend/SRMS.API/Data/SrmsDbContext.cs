using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Models;

namespace SRMS.API.Data;

public partial class SrmsDbContext : DbContext
{
    public SrmsDbContext(DbContextOptions<SrmsDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AgentWorkflowRun> AgentWorkflowRuns { get; set; }

    public virtual DbSet<AgentWorkflowStep> AgentWorkflowSteps { get; set; }

    public virtual DbSet<CameraSensor> CameraSensors { get; set; }

    public virtual DbSet<Intersection> Intersections { get; set; }

    public virtual DbSet<SensorFaultReport> SensorFaultReports { get; set; }

    public virtual DbSet<SignalTimingDecision> SignalTimingDecisions { get; set; }

    public virtual DbSet<SignalTimingProposal> SignalTimingProposals { get; set; }

    public virtual DbSet<TelemetryReading> TelemetryReadings { get; set; }

    public virtual DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AgentWorkflowRun>(entity =>
        {
            entity.HasIndex(e => e.IntersectionId, "IX_AgentWorkflowRuns_IntersectionId");

            entity.HasIndex(e => e.Status, "IX_AgentWorkflowRuns_Status");

            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.HasOne(d => d.Intersection).WithMany(p => p.AgentWorkflowRuns)
                .HasForeignKey(d => d.IntersectionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AgentWorkflowStep>(entity =>
        {
            entity.HasIndex(e => e.WorkflowRunId, "IX_AgentWorkflowSteps_WorkflowRunId");

            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.HasOne(d => d.WorkflowRun).WithMany(p => p.AgentWorkflowSteps).HasForeignKey(d => d.WorkflowRunId);
        });

        modelBuilder.Entity<CameraSensor>(entity =>
        {
            entity.HasIndex(e => new { e.IntersectionId, e.LaneLabel }, "IX_CameraSensors_IntersectionId_LaneLabel").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.HasOne(d => d.Intersection).WithMany(p => p.CameraSensors).HasForeignKey(d => d.IntersectionId);
        });

        modelBuilder.Entity<Intersection>(entity =>
        {
            entity.Property(e => e.Id).ValueGeneratedNever();
        });

        modelBuilder.Entity<SensorFaultReport>(entity =>
        {
            entity.HasIndex(e => e.CameraSensorId, "IX_SensorFaultReports_CameraSensorId");

            entity.HasIndex(e => e.ReportedByUserId, "IX_SensorFaultReports_ReportedByUserId");

            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.HasOne(d => d.CameraSensor).WithMany(p => p.SensorFaultReports).HasForeignKey(d => d.CameraSensorId);

            entity.HasOne(d => d.ReportedByUser).WithMany(p => p.SensorFaultReports)
                .HasForeignKey(d => d.ReportedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SignalTimingDecision>(entity =>
        {
            entity.HasIndex(e => e.DecidedByUserId, "IX_SignalTimingDecisions_DecidedByUserId");

            entity.HasIndex(e => e.ProposalId, "IX_SignalTimingDecisions_ProposalId").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.HasOne(d => d.DecidedByUser).WithMany(p => p.SignalTimingDecisions)
                .HasForeignKey(d => d.DecidedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Proposal).WithOne(p => p.SignalTimingDecision).HasForeignKey<SignalTimingDecision>(d => d.ProposalId);
        });

        modelBuilder.Entity<SignalTimingProposal>(entity =>
        {
            entity.HasIndex(e => e.IntersectionId, "IX_SignalTimingProposals_IntersectionId");

            entity.HasIndex(e => e.WorkflowRunId, "IX_SignalTimingProposals_WorkflowRunId");

            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.HasOne(d => d.Intersection).WithMany(p => p.SignalTimingProposals)
                .HasForeignKey(d => d.IntersectionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.WorkflowRun).WithMany(p => p.SignalTimingProposals).HasForeignKey(d => d.WorkflowRunId);
        });

        modelBuilder.Entity<TelemetryReading>(entity =>
        {
            entity.HasIndex(e => e.CameraSensorId, "IX_TelemetryReadings_CameraSensorId");

            entity.HasIndex(e => new { e.IntersectionId, e.Timestamp }, "IX_TelemetryReadings_IntersectionId_Timestamp");

            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.HasOne(d => d.CameraSensor).WithMany(p => p.TelemetryReadings).HasForeignKey(d => d.CameraSensorId);

            entity.HasOne(d => d.Intersection).WithMany(p => p.TelemetryReadings)
                .HasForeignKey(d => d.IntersectionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.Email, "IX_Users_Email").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
