using Microsoft.EntityFrameworkCore;
using SRMS.API.Models;

namespace SRMS.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<RoadHazardReport> RoadHazardReports { get; set; }
    public DbSet<AiWorkflowExecution> AiWorkflowExecutions { get; set; }
}