using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "MUNICIPAL_OFFICER")]
public class WorkersController : ControllerBase
{
    private static readonly string[] ActiveStatuses = { "PENDING_APPROVAL", "ASSIGNED", "IN_PROGRESS" };

    private readonly AppDbContext _db;

    public WorkersController(AppDbContext db)
    {
        _db = db;
    }

    // GET: api/workers?status=AVAILABLE
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        var query = _db.Workers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(w => w.Status == status);

        var workers = await query.OrderBy(w => w.FullName).ToListAsync();
        var ids = workers.Select(w => w.WorkerId).ToList();

        var counts = await _db.WorkOrders.AsNoTracking()
            .Where(o => ids.Contains(o.WorkerId) && ActiveStatuses.Contains(o.Status))
            .GroupBy(o => o.WorkerId)
            .Select(g => new { WorkerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.WorkerId, x => x.Count);

        var logins = await LoginsByWorkerAsync(ids);

        var data = workers.Select(w => ToDto(w, counts.GetValueOrDefault(w.WorkerId), logins.GetValueOrDefault(w.WorkerId)));
        return Ok(new { success = true, data });
    }

    // POST: api/workers
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FullName))
            return BadRequest(new { success = false, error = "Worker name is required." });

        var worker = new MunicipalWorker
        {
            FullName = req.FullName.Trim(),
            Specialty = string.IsNullOrWhiteSpace(req.Specialty) ? "GENERAL" : req.Specialty,
            Phone = req.Phone,
            Email = req.Email,
            Status = string.IsNullOrWhiteSpace(req.Status) ? "AVAILABLE" : req.Status,
        };

        _db.Workers.Add(worker);

        string? username = null;
        if (!string.IsNullOrWhiteSpace(req.Username))
        {
            if (string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { success = false, error = "A password is required to create a worker login." });

            username = req.Username.Trim();
            if (await _db.Users.AnyAsync(u => u.Username == username))
                return Conflict(new { success = false, error = $"Username '{username}' is already taken." });

            _db.Users.Add(new AppUser
            {
                Username = username,
                FullName = worker.FullName,
                Email = worker.Email,
                Role = "MUNICIPAL_WORKER",
                WorkerId = worker.WorkerId,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { success = true, data = ToDto(worker, 0, username) });
    }

    // PUT: api/workers/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkerRequest req)
    {
        var worker = await _db.Workers.FindAsync(id);
        if (worker == null)
            return NotFound(new { success = false, error = "Worker not found." });

        if (string.IsNullOrWhiteSpace(req.FullName))
            return BadRequest(new { success = false, error = "Worker name is required." });

        worker.FullName = req.FullName.Trim();
        worker.Specialty = string.IsNullOrWhiteSpace(req.Specialty) ? worker.Specialty : req.Specialty;
        worker.Phone = req.Phone;
        worker.Email = req.Email;
        worker.Status = string.IsNullOrWhiteSpace(req.Status) ? worker.Status : req.Status;

        var login = await _db.Users.FirstOrDefaultAsync(u => u.WorkerId == id);
        var username = login?.Username;

        if (!string.IsNullOrWhiteSpace(req.Username))
        {
            var desired = req.Username.Trim();
            if (await _db.Users.AnyAsync(u => u.Username == desired && u.WorkerId != id))
                return Conflict(new { success = false, error = $"Username '{desired}' is already taken." });

            if (login == null)
            {
                if (string.IsNullOrWhiteSpace(req.Password))
                    return BadRequest(new { success = false, error = "A password is required to create a worker login." });

                login = new AppUser
                {
                    Username = desired,
                    FullName = worker.FullName,
                    Email = worker.Email,
                    Role = "MUNICIPAL_WORKER",
                    WorkerId = worker.WorkerId,
                };
                _db.Users.Add(login);
            }
            else
            {
                login.Username = desired;
            }

            username = desired;
        }

        if (login != null)
        {
            if (!string.IsNullOrWhiteSpace(req.Password))
                login.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);

            login.FullName = worker.FullName;
            login.Email = worker.Email;
        }

        await _db.SaveChangesAsync();

        var activeJobs = await _db.WorkOrders.CountAsync(o => o.WorkerId == id && ActiveStatuses.Contains(o.Status));
        return Ok(new { success = true, data = ToDto(worker, activeJobs, username) });
    }

    // DELETE: api/workers/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var worker = await _db.Workers.FindAsync(id);
        if (worker == null)
            return NotFound(new { success = false, error = "Worker not found." });

        var hasOrders = await _db.WorkOrders.AnyAsync(o => o.WorkerId == id);
        if (hasOrders)
            return BadRequest(new { success = false, error = "This worker has work orders on record. Set them to INACTIVE instead." });

        var logins = await _db.Users.Where(u => u.WorkerId == id).ToListAsync();
        _db.Users.RemoveRange(logins);
        _db.Workers.Remove(worker);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Worker removed." });
    }

    private async Task<Dictionary<Guid, string>> LoginsByWorkerAsync(List<Guid> workerIds)
    {
        var rows = await _db.Users.AsNoTracking()
            .Where(u => u.WorkerId != null)
            .Select(u => new { u.WorkerId, u.Username })
            .ToListAsync();

        return rows
            .Where(r => r.WorkerId.HasValue && workerIds.Contains(r.WorkerId.Value))
            .ToDictionary(r => r.WorkerId!.Value, r => r.Username);
    }

    private static WorkerDto ToDto(MunicipalWorker w, int activeJobs, string? username = null) => new()
    {
        WorkerId = w.WorkerId,
        FullName = w.FullName,
        Specialty = w.Specialty,
        Phone = w.Phone,
        Email = w.Email,
        Status = w.Status,
        ActiveJobs = activeJobs,
        HasLogin = !string.IsNullOrEmpty(username),
        Username = username,
        CreatedAt = w.CreatedAt,
    };
}
