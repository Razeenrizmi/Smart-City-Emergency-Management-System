namespace SRMS.API.Services;

/// <summary>
/// Abstraction over the Google Gemini API for the hazard domain: vision
/// classification of a submitted photo and the natural-language copilot.
/// Implementations must never throw to callers — return <c>null</c> on any
/// failure so the caller can fall back to the deterministic heuristic.
/// </summary>
public interface IGeminiClient
{
    bool IsConfigured { get; }

    /// <summary>Classifies a hazard photo; returns null when unavailable/unusable.</summary>
    Task<GeminiHazardClassification?> ClassifyHazardImageAsync(
        string imageBase64,
        string mimeType,
        double accelerometerSpike,
        CancellationToken ct = default);

    /// <summary>Answers a copilot question grounded in the supplied hazard dataset; null on failure.</summary>
    Task<GeminiCopilotAnswer?> AnswerCopilotAsync(
        string userQuestion,
        string hazardsContextJson,
        CancellationToken ct = default);
}

public sealed record GeminiHazardClassification(
    string DetectedCategory,
    double ConfidenceScore,
    string AnalysisSummary);

public sealed record GeminiCopilotAnswer(
    string Message,
    string Intent,
    List<Guid> RelatedHazardIds);
