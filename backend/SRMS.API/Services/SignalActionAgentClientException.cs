namespace SRMS.API.Services;

public class SignalActionAgentClientException : Exception
{
    public int StatusCode { get; }

    public string ErrorCode { get; }

    public SignalActionAgentClientException(int statusCode, string errorCode, string message)
        : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}
