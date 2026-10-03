using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;
using SRMS.API.Services;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;

    public AuthController(AppDbContext db, TokenService tokens)
    {
        _db = db;
        _tokens = tokens;
    }

    // POST: api/auth/login
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { success = false, error = "Username and password are required." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
        if (user == null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { success = false, error = "Invalid username or password." });

        var (token, expiresAt) = _tokens.GenerateToken(user);

        return Ok(new
        {
            success = true,
            data = new LoginResponse
            {
                Token = token,
                ExpiresAt = expiresAt,
                User = ToDto(user),
            }
        });
    }

    // GET: api/auth/me
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        if (!Guid.TryParse(User.FindFirst("sub")?.Value, out var userId))
            return Unauthorized(new { success = false, error = "Invalid token." });

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
        if (user == null)
            return Unauthorized(new { success = false, error = "User not found." });

        return Ok(new { success = true, data = ToDto(user) });
    }

    private static UserDto ToDto(AppUser u) => new()
    {
        UserId = u.UserId,
        Username = u.Username,
        FullName = u.FullName,
        Email = u.Email,
        Role = u.Role,
        WorkerId = u.WorkerId,
    };
}
