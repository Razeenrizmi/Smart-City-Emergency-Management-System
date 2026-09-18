using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;
using SRMS.API.Services;

var builder = WebApplication.CreateBuilder(args);

const string WebDevCorsPolicy = "WebDevCorsPolicy";

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<SrmsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("SrmsDb")));

builder.Services.AddCors(options =>
{
    // Vite's default dev server origin — React and Flutter are required to
    // talk only to this API, never directly to the database, so this is
    // scoped to just the browser dev origin rather than AllowAnyOrigin.
    options.AddPolicy(WebDevCorsPolicy, policy =>
        policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddHostedService<CameraTelemetrySimulatorService>();

var app = builder.Build();

// Apply pending migrations and seed a couple of junctions on startup, so a
// fresh clone + `dotnet run` has something to show immediately.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SrmsDbContext>();
    db.Database.Migrate();

    if (!db.RoadJunctions.Any())
    {
        var now = DateTime.UtcNow;
        db.RoadJunctions.AddRange(
            new RoadJunction
            {
                Id = Guid.NewGuid(),
                JunctionName = "5th Ave & Main St",
                Latitude = 6.927100m,
                Longitude = 79.861200m,
                CurrentSignalState = "GREEN",
                CreatedAt = now,
                UpdatedAt = now,
            },
            new RoadJunction
            {
                Id = Guid.NewGuid(),
                JunctionName = "Harbor Blvd & Ocean Dr",
                Latitude = 6.933500m,
                Longitude = 79.849800m,
                CurrentSignalState = "RED",
                CreatedAt = now,
                UpdatedAt = now,
            });
        db.SaveChanges();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors(WebDevCorsPolicy);
app.MapControllers();

app.Run();
