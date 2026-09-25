namespace SRMS.API.Configuration;

public class AiServiceOptions
{
    public const string SectionName = "AiService";

    public string BaseUrl { get; set; } = "http://localhost:8000";

    public int TimeoutSeconds { get; set; } = 30;
}
