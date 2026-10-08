using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SRMS.API.Data;

namespace SRMS.API.Tests.Support;

/// <summary>
/// Shared helpers for resolving the PostgreSQL test connection used by the
/// Postgres-backed suites. Mirrors the resolution order of the existing
/// <c>EmergencyGreenWavePostgresTests</c>: env var first, then the shared
/// ASP.NET user secret, otherwise fail loudly.
/// </summary>
internal static class TestDatabase
{
    public static string ResolveConnectionString() =>
        Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION")
        ?? new ConfigurationBuilder()
            .AddUserSecrets(typeof(TestDatabase).Assembly)
            .Build()["ConnectionStrings:DefaultConnection"]
        ?? throw new InvalidOperationException(
            "Set TEST_POSTGRES_CONNECTION or configure the shared ASP.NET user secret before running backend tests.");

    public static AppDbContext CreateContext(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options);
}
