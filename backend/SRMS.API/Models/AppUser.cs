using System.ComponentModel.DataAnnotations;

namespace SRMS.API.Models;

/// <summary>
/// Authenticated system user. Currently used by municipal officers who operate the
/// web dashboard. The Worker role is reserved for a future worker-facing app.
/// </summary>
public class AppUser
{
    [Key]
    public Guid UserId { get; set; } = Guid.NewGuid();

    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>MUNICIPAL_OFFICER | MUNICIPAL_WORKER</summary>
    public string Role { get; set; } = "MUNICIPAL_OFFICER";

    /// <summary>
    /// For MUNICIPAL_WORKER logins: the municipal worker record this account belongs to.
    /// Null for officers.
    /// </summary>
    public Guid? WorkerId { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
