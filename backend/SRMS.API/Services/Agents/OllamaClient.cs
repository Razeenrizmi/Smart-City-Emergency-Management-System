using System.Text;
using System.Text.Json;

namespace SRMS.API.Services.Agents;

// Thin wrapper around Ollama's local HTTP API (http://localhost:11434).
// Ollama runs entirely on this machine — no API key, no internet call, no
// cost — which is why it's the model behind this agent instead of a paid
// cloud LLM.
public class OllamaClient(HttpClient httpClient, IConfiguration config)
{
    private string Model => config["Ollama:Model"] ?? "llama3.2:1b";
    private string BaseUrl => config["Ollama:BaseUrl"] ?? "http://localhost:11434";

    public async Task<string> GenerateAsync(string prompt, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Serialize(new
        {
            model = Model,
            prompt,
            stream = false,
            // Low temperature: this is generating a numeric traffic-timing
            // recommendation, not creative writing — consistent, boring
            // answers are what we want here.
            options = new { temperature = 0.2 },
        });

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/api/generate")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };

        // Safe-failure guard: a hung/unreachable local Ollama should not
        // hang the whole telemetry loop forever.
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(30));

        var response = await httpClient.SendAsync(request, cts.Token);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("response").GetString() ?? string.Empty;
    }
}
