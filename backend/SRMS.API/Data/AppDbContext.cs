using Microsoft.EntityFrameworkCore;
using SRMS.API.Models;

namespace SRMS.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<RoadHazardReport> RoadHazardReports { get; set; }
    public DbSet<AiWorkflowExecution> AiWorkflowExecutions { get; set; }
    public DbSet<AppUser> Users { get; set; }
    public DbSet<MunicipalWorker> Workers { get; set; }
    public DbSet<RepairWorkOrder> WorkOrders { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AppUser>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<RepairWorkOrder>()
            .HasOne(w => w.Hazard)
            .WithMany()
            .HasForeignKey(w => w.HazardId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RepairWorkOrder>()
            .HasOne(w => w.Worker)
            .WithMany()
            .HasForeignKey(w => w.WorkerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
