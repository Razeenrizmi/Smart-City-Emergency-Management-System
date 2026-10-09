using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SRMS.API.Configuration;
using SRMS.API.Services;
using Xunit;

namespace SRMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="GeminiClient"/> using a stub <see cref="HttpMessageHandler"/>
/// — verifies request shaping (model in URL, API key, inline image) and response
/// parsing, and that the client degrades to <c>null</c> (never throws) on failure.
/// </summary>
public sealed class GeminiClientTests
{
    private static GeminiClient CreateClient(StubHttpMessageHandler handler, string apiKey = "test-key")
    {
        var options = Options.Create(new GeminiOptions
        {
            ApiKey = apiKey,
            Model = "gemini-2.5-flash",
            BaseUrl = "https://generativelanguage.googleapis.com/v1beta",
        });

        var http = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://generativelanguage.googleapis.com/v1beta/"),
        };

        return new GeminiClient(http, options, NullLogger<GeminiClient>.Instance);
    }

    private static string GeminiEnvelope(string innerJson) => JsonSerializer.Serialize(new
    {
        candidates = new[] { new { content = new { parts = new[] { new { text = innerJson } } } } },
    });

    [Fact]
    public void IsConfigured_reflects_the_api_key()
    {
        Assert.True(CreateClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)), "key").IsConfigured);
        Assert.False(CreateClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)), "").IsConfigured);
    }

    [Fact]
    public async Task Classify_parses_category_confidence_and_summary()
    {
        var inner = JsonSerializer.Serialize(new
        {
            detectedCategory = "POTHOLE",
            confidenceScore = 0.93,
            analysisSummary = "Deep pothole.",
        });
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(GeminiEnvelope(inner), Encoding.UTF8, "application/json"),
        });

        var result = await CreateClient(handler).ClassifyHazardImageAsync("BASE64IMAGEDATA", "image/jpeg", 12.5);

        Assert.NotNull(result);
        Assert.Equal("POTHOLE", result!.DetectedCategory);
        Assert.Equal(0.93, result.ConfidenceScore, 3);
        Assert.Equal("Deep pothole.", result.AnalysisSummary);
    }

    [Fact]
    public async Task Classify_request_targets_the_model_with_key_and_inline_image()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                GeminiEnvelope("{\"detectedCategory\":\"DEBRIS\",\"confidenceScore\":0.8,\"analysisSummary\":\"x\"}"),
                Encoding.UTF8, "application/json"),
        });

        await CreateClient(handler).ClassifyHazardImageAsync("BASE64IMAGEDATA", "image/jpeg", 10.0);

        var url = handler.LastRequest!.RequestUri!.ToString();
        Assert.Contains("models/gemini-2.5-flash:generateContent", url);
        Assert.Contains("key=test-key", url);
        Assert.Contains("inline_data", handler.LastBody!);
        Assert.Contains("BASE64IMAGEDATA", handler.LastBody!);
    }

    [Fact]
    public async Task Copilot_parses_message_intent_and_ids()
    {
        var id = Guid.NewGuid();
        var inner = JsonSerializer.Serialize(new
        {
            message = "3 severe potholes need urgent repair.",
            intent = "URGENT_HAZARDS",
            relatedHazardIds = new[] { id.ToString() },
        });
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(GeminiEnvelope(inner), Encoding.UTF8, "application/json"),
        });

        var result = await CreateClient(handler).AnswerCopilotAsync("worst potholes?", "{\"totalHazards\":1}");

        Assert.NotNull(result);
        Assert.Equal("3 severe potholes need urgent repair.", result!.Message);
        Assert.Equal("URGENT_HAZARDS", result.Intent);
        Assert.Contains(id, result.RelatedHazardIds);
    }

    [Fact]
    public async Task Returns_null_on_http_error()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var client = CreateClient(handler);

        Assert.Null(await client.ClassifyHazardImageAsync("abc", "image/jpeg", 0));
        Assert.Null(await client.AnswerCopilotAsync("q", "{}"));
    }

    [Fact]
    public async Task Returns_null_on_malformed_json()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("not json", Encoding.UTF8, "application/json"),
        });

        Assert.Null(await CreateClient(handler).ClassifyHazardImageAsync("abc", "image/jpeg", 0));
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) => _handler = handler;

        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            if (request.Content is not null)
            {
                LastBody = await request.Content.ReadAsStringAsync(cancellationToken);
            }

            return _handler(request);
        }
    }
}
