using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkOrdersController : ControllerBase
{
    private const string OfficerRole = "MUNICIPAL_OFFICER";
    private const string WorkerRole = "MUNICIPAL_WORKER";

    private static readonly string[] Priorities = { "LOW", "MEDIUM", "HIGH", "CRITICAL" };

    // Reports within this distance are treated as the same physical defect, so a
    // single completed repair retires them all.
    private const double SameSpotRadiusMeters = 5.0;

    private readonly AppDbContext _db;

    public WorkOrdersController(AppDbContext db)
    {
        _db = db;
    }

    // GET: api/workorders?status=ASSIGNED  (officer view)
    [HttpGet]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        var query = Query();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(o => o.Status == status);

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        return Ok(new { success = true, data = orders.Select(ToDto) });
    }

    // GET: api/workorders/pending  (officer dispatch sign-off queue)
    [HttpGet("pending")]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> GetPending()
    {
        var orders = await Query()
            .Where(o => o.Status == "PENDING_APPROVAL")
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return Ok(new { success = true, data = orders.Select(ToDto) });
    }

    // GET: api/workorders/mine  (jobs assigned to the signed-in worker)
    [HttpGet("mine")]
    [Authorize(Roles = WorkerRole)]
    public async Task<IActionResult> GetMine()
    {
        var workerId = await CallerWorkerIdAsync();
        if (workerId == null)
            return Ok(new { success = true, data = Array.Empty<WorkOrderDto>() });

        // Dispatches awaiting sign-off are shown too, so the worker sees work that
        // has been assigned to them; they simply cannot start it until approved.
        var orders = await Query()
            .Where(o => o.WorkerId == workerId && o.Status != "CANCELLED")
            .OrderBy(o => o.Status == "COMPLETED" ? 1 : 0)
            .ThenByDescending(o => o.CreatedAt)
            .ToListAsync();

        return Ok(new { success = true, data = orders.Select(ToDto) });
    }

    // POST: api/workorders  (officer assigns a worker)
    [HttpPost]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> Create([FromBody] CreateWorkOrderRequest req)
    {
        var hazard = await _db.RoadHazardReports.FindAsync(req.HazardId);
        if (hazard == null)
            return NotFound(new { success = false, error = "Hazard report not found." });

        if (hazard.ApprovalStatus != "APPROVED")
            return BadRequest(new { success = false, error = "Only approved hazards can be assigned to a worker." });

        var worker = await _db.Workers.FindAsync(req.WorkerId);
        if (worker == null)
            return NotFound(new { success = false, error = "Worker not found." });

        if (worker.Status == "INACTIVE")
            return BadRequest(new { success = false, error = "This worker is inactive." });

        var alreadyActive = await _db.WorkOrders
            .AnyAsync(o => o.HazardId == req.HazardId && o.Status != "CANCELLED" && o.Status != "COMPLETED");
        if (alreadyActive)
            return Conflict(new { success = false, error = "This hazard already has an active work order." });

        Guid.TryParse(User.FindFirst("sub")?.Value, out var userId);

        var order = new RepairWorkOrder
        {
            HazardId = req.HazardId,
            WorkerId = req.WorkerId,
            AssignedByUserId = userId,
            AssignedByName = User.FindFirst("name")?.Value ?? "Officer",
            Priority = NormalizePriority(req.Priority),
            Notes = req.Notes,
            Status = "PENDING_APPROVAL",
        };

        _db.WorkOrders.Add(order);
        await _db.SaveChangesAsync();

        var created = await Query().FirstAsync(o => o.WorkOrderId == order.WorkOrderId);
        return Ok(new { success = true, message = "Dispatch request created.", data = ToDto(created) });
    }

    // PUT: api/workorders/{id}/approve  (officer signs off the dispatch)
    [HttpPut("{id:guid}/approve")]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var order = await Tracked(id);
        if (order == null)
            return NotFound(new { success = false, error = "Work order not found." });

        if (order.Status != "PENDING_APPROVAL")
            return BadRequest(new { success = false, error = "Only pending dispatch requests can be approved." });

        order.Status = "ASSIGNED";
        order.ApprovedAt = DateTime.UtcNow;
        if (order.Worker != null && order.Worker.Status != "INACTIVE")
            order.Worker.Status = "BUSY";

        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Dispatch approved.", data = ToDto(order) });
    }

    // PUT: api/workorders/{id}/reject  (officer rejects the dispatch)
    [HttpPut("{id:guid}/reject")]
    [Authorize(Roles = OfficerRole)]
    public async Task<IActionResult> Reject(Guid id)
    {
        var order = await Tracked(id);
        if (order == null)
            return NotFound(new { success = false, error = "Work order not found." });

        if (order.Status != "PENDING_APPROVAL")
            return BadRequest(new { success = false, error = "Only pending dispatch requests can be rejected." });

        order.Status = "CANCELLED";
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Dispatch request rejected.", data = ToDto(order) });
    }

    // PUT: api/workorders/{id}/status  (assigned worker starts / completes their own job)
    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = WorkerRole)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateWorkOrderStatusRequest req)
    {
        var target = (req.Status ?? string.Empty).Trim().ToUpperInvariant();
        if (target is not ("IN_PROGRESS" or "COMPLETED"))
            return BadRequest(new { success = false, error = "Status must be IN_PROGRESS or COMPLETED." });

        var workerId = await CallerWorkerIdAsync();
        if (workerId == null)
            return Forbid();

        var order = await Tracked(id);
        if (order == null)
            return NotFound(new { success = false, error = "Work order not found." });

        if (order.WorkerId != workerId)
            return StatusCode(StatusCodes.Status403Forbidden, new { success = false, error = "This job is not assigned to you." });

        if (target == "IN_PROGRESS" && order.Status != "ASSIGNED")
            return BadRequest(new { success = false, error = "Only jobs assigned to you can be started." });

        if (target == "COMPLETED" && order.Status != "IN_PROGRESS")
            return BadRequest(new { success = false, error = "Start the job before marking it complete." });

        order.Status = target;

        if (target == "COMPLETED")
        {
            order.CompletedAt = DateTime.UtcNow;

            // The repair is done: retire every report at this spot and cancel any
            // duplicate dispatches, so the markers leave the live map together.
            await ResolveSpotAsync(order);
        }

        await _db.SaveChangesAsync();
        return Ok(new { success = true, data = ToDto(order) });
    }

    private async Task<Guid?> CallerWorkerIdAsync()
    {
        if (!Guid.TryParse(User.FindFirst("sub")?.Value, out var userId))
            return null;

        return await _db.Users.AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => u.WorkerId)
            .FirstOrDefaultAsync();
    }

    // Retires the repaired hazard plus every other report within SameSpotRadiusMeters,
    // and cancels duplicate dispatches so nobody is sent to re-fix the same defect.
    private async Task ResolveSpotAsync(RepairWorkOrder order)
    {
        var origin = order.Hazard;
        if (origin == null)
            return;

        var lat = (double)origin.Latitude;
        var lng = (double)origin.Longitude;
        var latDelta = (decimal)(SameSpotRadiusMeters / 111_320.0);
        var lngDelta = (decimal)(SameSpotRadiusMeters / (111_320.0 * Math.Cos(lat * Math.PI / 180.0)));

        // Cheap bounding-box filter in SQL, then an exact distance check in memory.
        var candidates = await _db.RoadHazardReports
            .Where(h => h.ApprovalStatus != "RESOLVED"
                && h.Latitude >= origin.Latitude - latDelta && h.Latitude <= origin.Latitude + latDelta
                && h.Longitude >= origin.Longitude - lngDelta && h.Longitude <= origin.Longitude + lngDelta)
            .ToListAsync();

        var spotHazards = candidates
            .Where(h => DistanceMeters(lat, lng, (double)h.Latitude, (double)h.Longitude) <= SameSpotRadiusMeters)
            .ToList();

        if (origin.ApprovalStatus != "RESOLVED")
        {
            origin.ApprovalStatus = "RESOLVED";
            origin.ResolvedAt = DateTime.UtcNow;
        }

        foreach (var hazard in spotHazards)
        {
            hazard.ApprovalStatus = "RESOLVED";
            hazard.ResolvedAt ??= DateTime.UtcNow;
        }

        var spotHazardIds = spotHazards.Select(h => h.HazardId).ToList();
        if (!spotHazardIds.Contains(origin.HazardId))
            spotHazardIds.Add(origin.HazardId);

        var duplicates = await _db.WorkOrders
            .Include(o => o.Worker)
            .Where(o => o.WorkOrderId != order.WorkOrderId
                && o.Status != "CANCELLED" && o.Status != "COMPLETED"
                && spotHazardIds.Contains(o.HazardId))
            .ToListAsync();

        foreach (var duplicate in duplicates)
            duplicate.Status = "CANCELLED";

        await ReleaseWorkersAsync(order, duplicates);
    }

    // Sets BUSY workers back to AVAILABLE when they have no remaining active job,
    // counting the dispatches cancelled in this same unit of work as already closed.
    private async Task ReleaseWorkersAsync(RepairWorkOrder completed, IReadOnlyCollection<RepairWorkOrder> cancelled)
    {
        var workers = new Dictionary<Guid, MunicipalWorker>();
        if (completed.Worker != null)
            workers[completed.Worker.WorkerId] = completed.Worker;
        foreach (var order in cancelled)
            if (order.Worker != null)
                workers[order.Worker.WorkerId] = order.Worker;

        if (workers.Count == 0)
            return;

        var closedIds = new HashSet<Guid> { completed.WorkOrderId };
        foreach (var order in cancelled)
            closedIds.Add(order.WorkOrderId);

        var workerIds = workers.Keys.ToList();
        var openAssignments = await _db.WorkOrders
            .Where(o => workerIds.Contains(o.WorkerId)
                && o.Status != "CANCELLED" && o.Status != "COMPLETED")
            .Select(o => new { o.WorkOrderId, o.WorkerId })
            .ToListAsync();

        var stillBusy = openAssignments
            .Where(o => !closedIds.Contains(o.WorkOrderId))
            .Select(o => o.WorkerId)
            .ToHashSet();

        foreach (var worker in workers.Values)
            if (!stillBusy.Contains(worker.WorkerId) && worker.Status == "BUSY")
                worker.Status = "AVAILABLE";
    }

    private static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double EarthRadiusMeters = 6_371_000.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0)
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * EarthRadiusMeters * Math.Asin(Math.Min(1.0, Math.Sqrt(a)));
    }

    private async Task<RepairWorkOrder?> Tracked(Guid id) =>
        await _db.WorkOrders
            .Include(o => o.Hazard)
            .Include(o => o.Worker)
            .FirstOrDefaultAsync(o => o.WorkOrderId == id);

    private IQueryable<RepairWorkOrder> Query() =>
        _db.WorkOrders.AsNoTracking().Include(o => o.Hazard).Include(o => o.Worker);

    private static string NormalizePriority(string? priority)
    {
        var p = (priority ?? string.Empty).Trim().ToUpperInvariant();
        return Priorities.Contains(p) ? p : "MEDIUM";
    }

    private static WorkOrderDto ToDto(RepairWorkOrder o) => new()
    {
        WorkOrderId = o.WorkOrderId,
        HazardId = o.HazardId,
        HazardType = o.Hazard?.HazardType ?? string.Empty,
        SeverityScore = o.Hazard?.SeverityScore ?? 0,
        Latitude = o.Hazard?.Latitude ?? 0,
        Longitude = o.Hazard?.Longitude ?? 0,
        HazardImageUrl = o.Hazard?.ImageUrl,
        WorkerId = o.WorkerId,
        WorkerName = o.Worker?.FullName ?? string.Empty,
        WorkerSpecialty = o.Worker?.Specialty ?? string.Empty,
        Priority = o.Priority,
        Status = o.Status,
        Notes = o.Notes,
        AssignedByUserId = o.AssignedByUserId,
        AssignedByName = o.AssignedByName,
        CreatedAt = o.CreatedAt,
        ApprovedAt = o.ApprovedAt,
        CompletedAt = o.CompletedAt,
    };
}
