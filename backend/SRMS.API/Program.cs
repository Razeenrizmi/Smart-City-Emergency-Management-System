using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors(WebDevCorsPolicy);
app.MapControllers();

app.Run();
