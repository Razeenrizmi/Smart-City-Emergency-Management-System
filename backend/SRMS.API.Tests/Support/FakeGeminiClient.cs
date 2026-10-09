using SRMS.API.Services;

namespace SRMS.API.Tests.Support;

/// <summary>
/// In-memory <see cref="IGeminiClient"/> for unit tests: returns whatever canned
/// result the test sets (or null to force the caller's fallback path) and captures
/// the last copilot question/context for assertions. Lets the hazard AI be tested
/// without a real Gemini key or network call.
/// </summary>
internal sealed class FakeGeminiClient : IGeminiClient
{
    public bool Configured { get; set; } = true;
    public bool IsConfigured => Configured;

    public GeminiHazardClassification? VisionResult { get; set; }
    public GeminiCopilotAnswer? CopilotResult { get; set; }

    public string? LastQuestion { get; private set; }
    public string? LastContextJson { get; private set; }

    public Task<GeminiHazardClassification?> ClassifyHazardImageAsync(
        string imageBase64, string mimeType, double accelerometerSpike, CancellationToken ct = default)
        => Task.FromResult(VisionResult);

    public Task<GeminiCopilotAnswer?> AnswerCopilotAsync(
        string userQuestion, string hazardsContextJson, CancellationToken ct = default)
    {
        LastQuestion = userQuestion;
        LastContextJson = hazardsContextJson;
        return Task.FromResult(CopilotResult);
    }
}
