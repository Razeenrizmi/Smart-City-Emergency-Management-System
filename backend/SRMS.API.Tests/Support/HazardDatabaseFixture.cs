using Microsoft.EntityFrameworkCore;
using Xunit;

namespace SRMS.API.Tests.Support;

/// <summary>
/// Applies migrations once so every hazard suite shares a ready schema, and
/// serializes the DB-backed suites through the <c>HazardsDb</c> collection.
///
/// It deliberately never drops the database. Point <c>TEST_POSTGRES_CONNECTION</c>
/// at a dedicated test database (e.g. <c>srms_test</c>), never your live one.
/// </summary>
public sealed class HazardDatabaseFixture : IAsyncLifetime
{
    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        ConnectionString = TestDatabase.ResolveConnectionString();

        await using var db = TestDatabase.CreateContext(ConnectionString);
        await db.Database.MigrateAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;
}

[CollectionDefinition("HazardsDb")]
public sealed class HazardsDbCollection : ICollectionFixture<HazardDatabaseFixture>
{
}
