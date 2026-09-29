using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/cctv")]
public class CctvController : ControllerBase
{
    private readonly AppDbContext _context;

    public CctvController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("nodes")]
    public async Task<ActionResult<ApiResponse<List<CctvNode>>>> GetNodes()
    {
        var nodes = await _context.CctvNodes.OrderBy(n => n.NodeId).ToListAsync();
        return Ok(ApiResponse<List<CctvNode>>.Ok(nodes));
    }

    [HttpGet("nodes/{nodeId:int}")]
    public async Task<ActionResult<ApiResponse<CctvNode>>> GetNode(int nodeId)
    {
        var node = await _context.CctvNodes.FirstOrDefaultAsync(n => n.NodeId == nodeId);
        if (node == null)
            return NotFound(ApiResponse<CctvNode>.Fail($"CCTV node {nodeId} not found"));
        return Ok(ApiResponse<CctvNode>.Ok(node));
    }

    [HttpPost("nodes")]
    public async Task<ActionResult<ApiResponse<CctvNode>>> CreateNode([FromBody] CctvNode node)
    {
        if (await _context.CctvNodes.AnyAsync(n => n.NodeId == node.NodeId))
            return Conflict(ApiResponse<CctvNode>.Fail($"CCTV node {node.NodeId} already exists"));

        node.Id = await _context.CctvNodes.AnyAsync()
            ? await _context.CctvNodes.MaxAsync(n => n.Id) + 1
            : 1;
        if (string.IsNullOrWhiteSpace(node.Status)) node.Status = "OFFLINE";
        if (string.IsNullOrWhiteSpace(node.CreatedAt)) node.CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        if (string.IsNullOrWhiteSpace(node.LastSeenAt)) node.LastSeenAt = "Never";

        _context.CctvNodes.Add(node);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetNode), new { nodeId = node.NodeId },
            ApiResponse<CctvNode>.Ok(node, "CCTV node registered"));
    }

    [HttpPut("nodes/{nodeId:int}")]
    public async Task<ActionResult<ApiResponse<CctvNode>>> UpdateNode(int nodeId, [FromBody] CctvNode update)
    {
        var node = await _context.CctvNodes.FirstOrDefaultAsync(n => n.NodeId == nodeId);
        if (node == null)
            return NotFound(ApiResponse<CctvNode>.Fail($"CCTV node {nodeId} not found"));

        node.CameraName = update.CameraName;
        node.Location = update.Location;
        node.CameraType = update.CameraType;
        node.StreamSource = update.StreamSource;
        node.StreamUrl = update.StreamUrl;
        node.Lat = update.Lat;
        node.Lng = update.Lng;

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<CctvNode>.Ok(node, "CCTV node updated"));
    }

    [HttpPut("nodes/{nodeId:int}/status")]
    public async Task<ActionResult<ApiResponse<CctvNode>>> UpdateNodeStatus(int nodeId, [FromBody] NodeStatusRequest request)
    {
        var node = await _context.CctvNodes.FirstOrDefaultAsync(n => n.NodeId == nodeId);
        if (node == null)
            return NotFound(ApiResponse<CctvNode>.Fail($"CCTV node {nodeId} not found"));

        var allowed = new[] { "ONLINE", "OFFLINE", "CONNECTING", "ERROR", "ANALYZING" };
        if (!allowed.Contains(request.Status))
            return BadRequest(ApiResponse<CctvNode>.Fail($"Invalid status '{request.Status}'. Allowed: {string.Join(", ", allowed)}"));

        node.Status = request.Status;
        node.LastSeenAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<CctvNode>.Ok(node, "Node status updated"));
    }

    /// <summary>
    /// Start a surveillance session on a node (called when the operator starts CCTV monitoring).
    /// Creates a node-scoped session: NODE{n}-SESSION-{seq}.
    /// </summary>
    [HttpPost("nodes/{nodeId:int}/start")]
    public async Task<ActionResult<ApiResponse<NodeSessionResponse>>> StartNode(int nodeId)
    {
        var node = await _context.CctvNodes.FirstOrDefaultAsync(n => n.NodeId == nodeId);
        if (node == null)
            return NotFound(ApiResponse<NodeSessionResponse>.Fail($"CCTV node {nodeId} not found"));

        // End any dangling active sessions for this node first.
        var dangling = await _context.DetectionSessions
            .Where(s => s.NodeId == nodeId && s.Status == "ACTIVE")
            .ToListAsync();
        foreach (var s in dangling)
        {
            s.Status = "ENDED";
            s.EndedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        }

        var seq = await _context.DetectionSessions.CountAsync(s => s.NodeId == nodeId) + 1;
        var sessionId = $"NODE{nodeId}-SESSION-{seq:D3}";

        var session = new DetectionSession
        {
            Id = await _context.DetectionSessions.AnyAsync()
                ? await _context.DetectionSessions.MaxAsync(s => s.Id) + 1
                : 1,
            SessionId = sessionId,
            NodeId = nodeId,
            StartedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
            EndedAt = null,
            Status = "ACTIVE"
        };
        _context.DetectionSessions.Add(session);

        node.Status = "ONLINE";
        node.LastSeenAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<NodeSessionResponse>.Ok(new NodeSessionResponse
        {
            SessionId = sessionId,
            NodeId = nodeId,
            StartedAt = session.StartedAt
        }, "Surveillance session started"));
    }

    /// <summary>
    /// Stop a node: end all active sessions and mark the node OFFLINE.
    /// </summary>
    [HttpPost("nodes/{nodeId:int}/stop")]
    public async Task<ActionResult<ApiResponse<CctvNode>>> StopNode(int nodeId)
    {
        var node = await _context.CctvNodes.FirstOrDefaultAsync(n => n.NodeId == nodeId);
        if (node == null)
            return NotFound(ApiResponse<CctvNode>.Fail($"CCTV node {nodeId} not found"));

        var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        var active = await _context.DetectionSessions
            .Where(s => s.NodeId == nodeId && s.Status == "ACTIVE")
            .ToListAsync();
        foreach (var s in active)
        {
            s.Status = "ENDED";
            s.EndedAt = now;
        }

        node.Status = "OFFLINE";
        node.LastSeenAt = now;

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<CctvNode>.Ok(node, "CCTV node stopped"));
    }

    [HttpGet("nodes/{nodeId:int}/sessions")]
    public async Task<ActionResult<ApiResponse<List<DetectionSession>>>> GetNodeSessions(int nodeId)
    {
        var sessions = await _context.DetectionSessions
            .Where(s => s.NodeId == nodeId)
            .OrderByDescending(s => s.Id)
            .ToListAsync();
        return Ok(ApiResponse<List<DetectionSession>>.Ok(sessions));
    }
}

public class NodeStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class NodeSessionResponse
{
    public string SessionId { get; set; } = string.Empty;
    public int NodeId { get; set; }
    public string StartedAt { get; set; } = string.Empty;
}
