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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Database.MigrateAsync();

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
