using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SRMS.API.Controllers;
using SRMS.API.Data;
using SRMS.API.Tests.Support;
using Xunit;

namespace SRMS.API.Tests;

/// <summary>
/// End-to-end HTTP tests for the hazards API exercised through the real MVC
/// pipeline (model validation + JWT authorization), hosted in-process on a
/// <see cref="TestServer"/>. Uses a real PostgreSQL database for persistence.
/// </summary>
[Collection("HazardsDb")]
public sealed class HazardsApiIntegrationTests : IAsyncLifetime
{
    private readonly List<Guid> _created = new();
    private readonly string _connectionString;
    private WebApplication _app = null!;
    private HttpClient _client = null!;

    public HazardsApiIntegrationTests(HazardDatabaseFixture fixture)
    {
        _connectionString = fixture.ConnectionString;
    }

    public async Task InitializeAsync()
    {
        var connectionString = _connectionString;

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Development",
            ContentRootPath = AppContext.BaseDirectory,
        });

        builder.WebHost.UseTestServer();
        builder.Services.AddControllers().AddApplicationPart(typeof(HazardsController).Assembly);
        builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = TokenFactory.Issuer,
                    ValidateAudience = true,
                    ValidAudience = TokenFactory.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TokenFactory.Key)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    NameClaimType = "name",
                    RoleClaimType = "role",
                };
            });
        builder.Services.AddAuthorization();

        _app = builder.Build();
        _app.UseAuthentication();
        _app.UseAuthorization();
        _app.MapControllers();
        await _app.StartAsync();

        _client = _app.GetTestClient();

        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (_created.Count > 0)
        {
            using var scope = _app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.RoadHazardReports
                .Where(h => _created.Contains(h.HazardId))
                .ExecuteDeleteAsync();
        }

        _client.Dispose();
        await _app.DisposeAsync();
    }

    // ── Normal ───────────────────────────────────────────────────────────────
    [Fact]
    public async Task Report_then_pending_then_approve_then_all_shows_approved()
    {
        var id = await ReportAsync(6.9271, 79.8850, 12.5);

        var officer = TokenFactory.Officer();

        var pending = await SendAsync(HttpMethod.Get, "/api/hazards/pending", officer);
        Assert.Equal(HttpStatusCode.OK, pending.StatusCode);
        Assert.Contains(id.ToString(), await pending.Content.ReadAsStringAsync());

        var approve = await SendAsync(HttpMethod.Put, $"/api/hazards/{id}/approve", officer);
        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);

        var all = await SendAsync(HttpMethod.Get, "/api/hazards/all", null);
        Assert.Equal(HttpStatusCode.OK, all.StatusCode);
        using var doc = JsonDocument.Parse(await all.Content.ReadAsStringAsync());
        var hazard = doc.RootElement.GetProperty("data").EnumerateArray()
            .Single(h => h.GetProperty("hazardId").GetGuid() == id);
        Assert.Equal("APPROVED", hazard.GetProperty("approvalStatus").GetString());
        Assert.True(hazard.GetProperty("isVerified").GetBoolean());
    }

    // ── Invalid / validation ─────────────────────────────────────────────────
    [Theory]
    [InlineData(95.0, 79.8850)]
    [InlineData(-91.0, 79.8850)]
    [InlineData(6.9271, 190.0)]
    [InlineData(6.9271, -181.0)]
    public async Task Report_with_out_of_range_coordinates_returns_400(double lat, double lng)
    {
        var response = await _client.PostAsJsonAsync("/api/hazards/report", new
        {
            latitude = lat,
            longitude = lng,
            accelerometerZSpike = 12.5,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Report_without_coordinates_returns_400()
    {
        var response = await _client.PostAsJsonAsync("/api/hazards/report", new
        {
            accelerometerZSpike = 12.5,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Security / authorization ─────────────────────────────────────────────
    [Fact]
    public async Task Approve_without_token_returns_401()
    {
        var id = await ReportAsync(6.9271, 79.8850, 12.5);

        var response = await SendAsync(HttpMethod.Put, $"/api/hazards/{id}/approve", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Approve_with_non_officer_token_returns_403()
    {
        var id = await ReportAsync(6.9271, 79.8850, 12.5);

        var response = await SendAsync(HttpMethod.Put, $"/api/hazards/{id}/approve", TokenFactory.Worker());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Pending_without_token_returns_401()
    {
        var response = await SendAsync(HttpMethod.Get, "/api/hazards/pending", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── Failure ──────────────────────────────────────────────────────────────
    [Fact]
    public async Task Approve_unknown_id_returns_404()
    {
        var response = await SendAsync(HttpMethod.Put, $"/api/hazards/{Guid.NewGuid()}/approve", TokenFactory.Officer());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Approve_already_approved_returns_400()
    {
        var id = await ReportAsync(6.9271, 79.8850, 12.5);
        var officer = TokenFactory.Officer();

        var first = await SendAsync(HttpMethod.Put, $"/api/hazards/{id}/approve", officer);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await SendAsync(HttpMethod.Put, $"/api/hazards/{id}/approve", officer);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private async Task<Guid> ReportAsync(double lat, double lng, double spike)
    {
        var response = await _client.PostAsJsonAsync("/api/hazards/report", new
        {
            latitude = lat,
            longitude = lng,
            accelerometerZSpike = spike,
            hazardType = "POTHOLE",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var id = doc.RootElement.GetProperty("id").GetGuid();
        _created.Add(id);
        return id;
    }

    private Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, string? token)
    {
        var request = new HttpRequestMessage(method, path);
        if (token is not null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return _client.SendAsync(request);
    }
}
