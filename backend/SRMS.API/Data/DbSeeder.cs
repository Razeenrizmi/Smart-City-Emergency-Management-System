using Microsoft.EntityFrameworkCore;
using SRMS.API.Models;

namespace SRMS.API.Data;

/// <summary>
/// Applies pending migrations and seeds baseline records on startup.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();

        // 1. Migrate AppDbContext
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        // 2. Migrate ApplicationDbContext (Emergency Green Wave)
        var greenWaveDb = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await greenWaveDb.Database.MigrateAsync();

        // 3. Migrate SrmsDbContext (Intersections, CameraSensors, Telemetry, etc.)
        var srmsDb = scope.ServiceProvider.GetRequiredService<SrmsDbContext>();
        await srmsDb.Database.MigrateAsync();

        if (!await srmsDb.Users.AnyAsync())
        {
            srmsDb.Users.AddRange(
                new User
                {
                    Id = Guid.NewGuid(),
                    Email = "traffic.control@srms.local",
                    FullName = "Traffic Control Staff",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("staff123"),
                    Role = "TrafficControlStaff",
                    CreatedAt = DateTime.UtcNow
                },
                new User
                {
                    Id = Guid.NewGuid(),
                    Email = "field.officer@srms.local",
                    FullName = "Field Officer",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("officer123"),
                    Role = "FieldOfficer",
                    CreatedAt = DateTime.UtcNow
                }
            );
            await srmsDb.SaveChangesAsync();
            app.Logger.LogInformation("Seeded default SrmsDb staff and field officer.");
        }

        if (!await srmsDb.Intersections.AnyAsync())
        {
            var now = DateTime.UtcNow;
            var junctionNames = new[]
            {
                ("Town Hall Junction", 6.9147, 79.8654),
                ("Kollupitiya Junction", 6.9100, 79.8517),
                ("Borella Junction", 6.9142, 79.8778),
                ("Bambalapitiya Junction", 6.8967, 79.8569)
            };

            foreach (var (name, lat, lng) in junctionNames)
            {
                var intersectionId = Guid.NewGuid();
                var intersection = new Intersection
                {
                    Id = intersectionId,
                    Name = name,
                    Latitude = lat,
                    Longitude = lng,
                    LaneCount = 4,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                srmsDb.Intersections.Add(intersection);

                var lanes = new[] { "Northbound", "Southbound", "Eastbound", "Westbound" };
                foreach (var lane in lanes)
                {
                    srmsDb.CameraSensors.Add(new CameraSensor
                    {
                        Id = Guid.NewGuid(),
                        IntersectionId = intersectionId,
                        LaneLabel = lane,
                        Status = "ONLINE",
                        InstalledAt = now
                    });
                }
            }
            await srmsDb.SaveChangesAsync();
            app.Logger.LogInformation("Seeded sample intersections and camera sensors.");
        }

        if (!await db.Users.AnyAsync(u => u.Username == "officer"))
        {
            db.Users.Add(new AppUser
            {
                Username = "officer",
                FullName = "Municipal Officer",
                Email = "officer@srms.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("officer123"),
                Role = "MUNICIPAL_OFFICER",
            });
            await db.SaveChangesAsync();
            app.Logger.LogInformation("Seeded default municipal officer account (officer / officer123).");
        }

        if (!await db.Workers.AnyAsync())
        {
            db.Workers.AddRange(
                new MunicipalWorker { FullName = "Nimal Perera", Specialty = "ROAD_REPAIR", Phone = "+94 71 234 5678", Status = "AVAILABLE" },
                new MunicipalWorker { FullName = "Sunil Fernando", Specialty = "DRAINAGE", Phone = "+94 77 876 5432", Status = "AVAILABLE" },
                new MunicipalWorker { FullName = "Kamal Silva", Specialty = "GENERAL", Phone = "+94 76 111 2233", Status = "AVAILABLE" });
            await db.SaveChangesAsync();
            app.Logger.LogInformation("Seeded sample municipal workers.");
        }

        // Every worker gets a login so they can sign in and manage their own jobs.
        var workersWithoutLogin = await db.Workers
            .Where(w => !db.Users.Any(u => u.WorkerId == w.WorkerId))
            .ToListAsync();

        var createdLogins = 0;
        foreach (var worker in workersWithoutLogin)
        {
            var baseUsername = new string(worker.FullName.Split(' ')[0]
                .ToLowerInvariant()
                .Where(char.IsLetterOrDigit)
                .ToArray());
            if (string.IsNullOrEmpty(baseUsername)) baseUsername = "worker";

            var username = baseUsername;
            var suffix = 1;
            while (await db.Users.AnyAsync(u => u.Username == username))
                username = $"{baseUsername}{++suffix}";

            db.Users.Add(new AppUser
            {
                Username = username,
                FullName = worker.FullName,
                Role = "MUNICIPAL_WORKER",
                WorkerId = worker.WorkerId,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("worker123"),
            });
            createdLogins++;
        }

        if (createdLogins > 0)
        {
            await db.SaveChangesAsync();
            app.Logger.LogInformation("Seeded {Count} municipal worker login(s) (password: worker123).", createdLogins);
        }
    }
}