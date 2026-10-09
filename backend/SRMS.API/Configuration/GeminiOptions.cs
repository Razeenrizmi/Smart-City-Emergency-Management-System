namespace SRMS.API.Configuration;

/// <summary>
/// Google Gemini configuration for the hazard AI (image classification + copilot).
/// Bound from the "Gemini" config section. The API key is intentionally NOT committed —
/// supply it via user secrets (<c>dotnet user-secrets set "Gemini:ApiKey" "..."</c>) or
/// the environment variable <c>Gemini__ApiKey</c>. When it is absent the hazard AI
/// falls back to the deterministic heuristic.
/// </summary>
public class GeminiOptions
{
    public const string SectionName = "Gemini";

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = "gemini-2.5-flash";

    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";

    public int TimeoutSeconds { get; set; } = 30;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
