using Xunit;

// The Postgres-backed suites all share one test database and apply migrations
// in InitializeAsync. Running collections in parallel races on CREATE TABLE /
// migration history, so execute everything serially.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
