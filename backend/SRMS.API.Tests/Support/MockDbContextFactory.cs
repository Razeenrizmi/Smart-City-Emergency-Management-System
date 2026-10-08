using Microsoft.EntityFrameworkCore;
using Moq;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Tests.Support;

/// <summary>
/// Builds a Moq-backed <see cref="AppDbContext"/> whose <c>RoadHazardReports</c>
/// DbSet is backed by an in-memory list. Lets the controller's severity and
/// state-transition logic be unit-tested without a database.
/// </summary>
internal static class MockDbContextFactory
{
    public static (Mock<AppDbContext> Context, List<RoadHazardReport> Store) Create(
        IEnumerable<RoadHazardReport>? seed = null)
    {
        var store = seed?.ToList() ?? new List<RoadHazardReport>();

        var set = new Mock<DbSet<RoadHazardReport>>();
        set.Setup(s => s.Add(It.IsAny<RoadHazardReport>()))
            .Callback<RoadHazardReport>(store.Add);
        set.Setup(s => s.FindAsync(It.IsAny<object[]>()))
            .Returns<object[]>(keys => new ValueTask<RoadHazardReport?>(
                store.FirstOrDefault(h => h.HazardId == (Guid)keys[0])));

        var context = new Mock<AppDbContext>(new DbContextOptionsBuilder<AppDbContext>().Options);
        context.Setup(c => c.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        context.Object.RoadHazardReports = set.Object;

        return (context, store);
    }

    /// <summary>
    /// Same as <see cref="Create"/> but also fakes <c>AiWorkflowExecutions</c> so the
    /// AI triage service (which audits every classification) can be unit-tested
    /// without a database. Returns the executions list so tests can assert what
    /// was written.
    /// </summary>
    public static (
        Mock<AppDbContext> Context,
        List<RoadHazardReport> Hazards,
        List<HazardAiWorkflowExecution> Executions)
        CreateWithAi(IEnumerable<RoadHazardReport>? seed = null)
    {
        var (context, hazards) = Create(seed);
        var executions = new List<HazardAiWorkflowExecution>();

        var set = new Mock<DbSet<HazardAiWorkflowExecution>>();
        set.Setup(s => s.Add(It.IsAny<HazardAiWorkflowExecution>()))
            .Callback<HazardAiWorkflowExecution>(executions.Add);
        context.Object.AiWorkflowExecutions = set.Object;

        return (context, hazards, executions);
    }
}
