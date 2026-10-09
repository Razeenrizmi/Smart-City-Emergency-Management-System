using Microsoft.Extensions.Logging.Abstractions;
using SRMS.API.Models;
using SRMS.API.Services;
using SRMS.API.Tests.Support;
using Xunit;

namespace SRMS.API.Tests;

/// <summary>
/// Contract tests for the hazard AI triage pipeline (<see cref="AiVisionService"/>):
/// classification schema, confidence bounds, determinism, sensor corroboration and
/// the 0.75 auto-verification boundary. No external model or database is required —
/// the vision service writes its audit row to a Moq-backed <c>AiWorkflowExecutions</c>.
/// </summary>
public sealed class AiTriageTests
{
    private static readonly string[] Categories =
        ["POTHOLE", "ROAD_CRACK", "DEBRIS", "FLOODING", "SURFACE_DAMAGE"];

    private static AiVisionService CreateService(out List<HazardAiWorkflowExecution> audit)
    {
        var (context, _, executions) = MockDbContextFactory.CreateWithAi();
        audit = executions;
        return new AiVisionService(context.Object, NullLogger<AiVisionService>.Instance);
    }

    [Fact]
    public async Task Classify_returns_category_within_the_supported_set()
    {
        var service = CreateService(out _);

        var result = await service.ClassifyImageAsync("pothole-image-payload", null, 12.5);

        Assert.Contains(result.DetectedCategory, Categories);
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(12.5)]
    [InlineData(20.0)]
    public async Task Confidence_is_bounded(double spike)
    {
        var service = CreateService(out _);

        var result = await service.ClassifyImageAsync("some-image", null, spike);

        Assert.InRange(result.ConfidenceScore, 0.72, 0.99);
    }

    [Fact]
    public async Task Same_image_is_deterministic()
    {
        var service = CreateService(out _);

        var a = await service.ClassifyImageAsync("identical-payload", null, 12.5);
        var b = await service.ClassifyImageAsync("identical-payload", null, 12.5);

        Assert.Equal(a.DetectedCategory, b.DetectedCategory);
        Assert.Equal(a.ConfidenceScore, b.ConfidenceScore);
    }

    [Fact]
    public async Task AutoVerified_flag_matches_the_0_75_threshold()
    {
        var service = CreateService(out _);

        foreach (var payload in new[] { "img-a", "img-b", "img-c", "img-d", "img-e", "img-f" })
        {
            var result = await service.ClassifyImageAsync(payload, null, 0.0);
            Assert.Equal(result.ConfidenceScore >= 0.75, result.IsAutoVerified);
        }
    }

    [Fact]
    public async Task Spike_boost_raises_confidence_but_never_exceeds_cap()
    {
        var service = CreateService(out _);

        var low = await service.ClassifyImageAsync("same", null, 0.0);
        var high = await service.ClassifyImageAsync("same", null, 20.0);

        Assert.True(high.ConfidenceScore >= low.ConfidenceScore);
        Assert.True(high.ConfidenceScore <= 0.99);
    }

    [Fact]
    public async Task Vision_classification_is_audited()
    {
        var service = CreateService(out var audit);

        await service.ClassifyImageAsync("audit-me", Guid.NewGuid(), 12.5);

        Assert.Contains(audit, e => e.WorkflowType == "VISION_CLASSIFY");
    }

    // ── Gemini-backed vision (fake client, no network) ───────────────────────

    [Fact]
    public async Task Uses_gemini_classification_when_configured()
    {
        var (context, _, _) = MockDbContextFactory.CreateWithAi();
        var gemini = new FakeGeminiClient
        {
            VisionResult = new GeminiHazardClassification("FLOODING", 0.88, "Flooded junction."),
        };
        var service = new AiVisionService(context.Object, NullLogger<AiVisionService>.Instance, gemini);

        var result = await service.ClassifyImageAsync("img", null, 12.5);

        Assert.Equal("GEMINI", result.Source);
        Assert.Equal("FLOODING", result.DetectedCategory);
        Assert.True(result.IsAutoVerified); // 0.88 ≥ 0.75
        Assert.Equal("Flooded junction.", result.AnalysisSummary);
    }

    [Fact]
    public async Task Falls_back_to_heuristic_when_gemini_not_configured()
    {
        var (context, _, _) = MockDbContextFactory.CreateWithAi();
        var gemini = new FakeGeminiClient { Configured = false };
        var service = new AiVisionService(context.Object, NullLogger<AiVisionService>.Instance, gemini);

        var result = await service.ClassifyImageAsync("img", null, 12.5);

        Assert.Equal("HEURISTIC", result.Source);
        Assert.Contains(result.DetectedCategory, Categories);
    }

    [Fact]
    public async Task Rejects_off_schema_gemini_category_and_falls_back()
    {
        var (context, _, _) = MockDbContextFactory.CreateWithAi();
        var gemini = new FakeGeminiClient
        {
            VisionResult = new GeminiHazardClassification("ALIEN_SPACESHIP", 0.9, "n/a"),
        };
        var service = new AiVisionService(context.Object, NullLogger<AiVisionService>.Instance, gemini);

        var result = await service.ClassifyImageAsync("img", null, 12.5);

        Assert.Equal("HEURISTIC", result.Source);
    }
}
