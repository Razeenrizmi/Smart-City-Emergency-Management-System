using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace SRMS.API.Tests.Support;

/// <summary>
/// Mints JWTs that match the API's bearer configuration (short "role" claim,
/// <c>MapInboundClaims = false</c>) so the authorization pipeline accepts them
/// in the in-process test host.
/// </summary>
internal static class TokenFactory
{
    public const string Key = "srms-test-signing-key-please-change-0123456789";
    public const string Issuer = "SRMS.API.Tests";
    public const string Audience = "SRMS.Client.Tests";

    public static string Officer() => Create("MUNICIPAL_OFFICER");

    public static string Worker() => Create("MUNICIPAL_WORKER");

    public static string Create(string role)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: new[]
            {
                new Claim("sub", Guid.NewGuid().ToString()),
                new Claim("name", "Test User"),
                new Claim("role", role),
            },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
