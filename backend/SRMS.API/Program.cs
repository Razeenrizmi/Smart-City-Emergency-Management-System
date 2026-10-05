using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SRMS.API.Configuration;
using SRMS.API.Data;
using SRMS.API.Services;
using SRMS.API.Services.Agents;

var builder = WebApplication.CreateBuilder(args);

const string WebDevCorsPolicy = "WebDevCorsPolicy";

// Add services to the container.
builder.Services.AddControllers();

// Register Health Check service
builder.Services.AddHealthChecks();

// ─── AI Signal Action integration (Emergency Green Wave domain) ──────────────
builder.Services.Configure<AiServiceOptions>(
    builder.Configuration.GetSection(AiServiceOptions.SectionName));

builder.Services.AddHttpClient<SignalActionAgentClient>((serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<IOptions<AiServiceOptions>>().Value;
    var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl)
        ? "http://localhost:8000"
        : options.BaseUrl.Trim();

    if (!baseUrl.EndsWith('/'))
    {
        baseUrl += "/";
    }

    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds > 0 ? options.TimeoutSeconds : 30);
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});

builder.Services.AddScoped<SignalActionProposalService>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the JWT returned by /api/auth/login.",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
            },
            Array.Empty<string>()
        }
    });
});

// ─── Databases (two feature domains share the same PostgreSQL instance) ───────
// Hazard reporting, worker dispatch, accounts and work orders — plus the
// crime-vehicle detection tables (cameras, hotlist, detection logs, CCTV nodes).
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Emergency sessions, routes, junctions and signal preemption.
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ─── Hazard domain AI services ───────────────────────────────────────────────
builder.Services.AddScoped<AiVisionService>();
builder.Services.AddScoped<AiAnalystService>();

// Register authentication/token services
builder.Services.AddScoped<TokenService>();

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSection["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
            NameClaimType = "name",
            RoleClaimType = "role",
        };
    });

builder.Services.AddAuthorization();

// Add CORS policy — the dashboard web app and the Flutter mobile app both call this API.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddHttpClient("AIService", client =>
{
    var aiUrl = builder.Configuration["AIService:Url"] ?? "http://localhost:8000";
    client.BaseAddress = new Uri(aiUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddDbContext<SrmsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("SrmsDb")));

builder.Services.AddCors(options =>
{
    // Vite's default dev server origin plus the Flutter web dev origin —
    // React and Flutter are required to talk only to this API, never
    // directly to the database, so this is scoped to just these dev
    // origins rather than AllowAnyOrigin.
    options.AddPolicy(WebDevCorsPolicy, policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:5080").AllowAnyHeader().AllowAnyMethod());
});

// Your Agentic AI contribution's model client — Ollama runs locally on
// this machine (no API key, no cost), so this is just a plain named
// HttpClient pointed at its local port.
builder.Services.AddHttpClient<OllamaClient>();
builder.Services.AddScoped<SignalTimingAgentWorkflow>();

builder.Services.AddHostedService<CameraTelemetrySimulatorService>();

var app = builder.Build();

// Apply EF migrations and seed baseline data for every domain.
await DbSeeder.SeedAsync(app);

// EnsureCreated() is a no-op on existing databases — apply idempotent multi-CCTV
// schema changes so pre-existing smart_city databases pick up the new columns.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await SchemaMigrator.RunAsync(db);
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

// ─── Health Check & Root Route Mapping ────────────────────────────────────────
// Standard health check route for monitoring tools & project documentation
app.MapHealthChecks("/health");

// Redirect root GET / directly to /health so visiting the base URL works
app.MapGet("/", () => Results.Redirect("/health"));

app.MapControllers();

app.Run();