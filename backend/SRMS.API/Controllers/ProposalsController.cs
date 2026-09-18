using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Dtos;

namespace SRMS.API.Controllers;

public class ProposalsController(SrmsDbContext db) : BaseApiController
{
    // GET /api/proposals?status=pending|approved|rejected — defaults to
    // pending, which is what the React panel's "toggle" list shows.
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ProposalDto>>>> GetAll([FromQuery] string status = "pending")
    {
        var query = db.SignalAdjustmentProposals.AsNoTracking().Include(p => p.Junction).AsQueryable();

        query = status.ToLowerInvariant() switch
        {
            "approved" => query.Where(p => p.IsApprovedByOperator == true),
            "rejected" => query.Where(p => p.IsApprovedByOperator == false),
            "all" => query,
            _ => query.Where(p => p.IsApprovedByOperator == null),
        };

        var proposals = await query
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new ProposalDto(
                p.Id,
                p.JunctionId,
                p.Junction!.JunctionName,
                p.ProposedGreenExtensionSec,
                p.IsApprovedByOperator,
                p.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<ProposalDto>>.Ok(proposals));
    }

    [HttpPost("{id:guid}/approve")]
    public Task<ActionResult<ApiResponse<ProposalDto>>> Approve(Guid id) => SetApproval(id, true);

    [HttpPost("{id:guid}/reject")]
    public Task<ActionResult<ApiResponse<ProposalDto>>> Reject(Guid id) => SetApproval(id, false);

    private async Task<ActionResult<ApiResponse<ProposalDto>>> SetApproval(Guid id, bool approved)
    {
        var proposal = await db.SignalAdjustmentProposals.Include(p => p.Junction)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (proposal is null)
        {
            return NotFound(ApiResponse<ProposalDto>.Fail("Proposal not found."));
        }

        proposal.IsApprovedByOperator = approved;
        proposal.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var dto = new ProposalDto(
            proposal.Id,
            proposal.JunctionId,
            proposal.Junction!.JunctionName,
            proposal.ProposedGreenExtensionSec,
            proposal.IsApprovedByOperator,
            proposal.CreatedAt);

        return Ok(ApiResponse<ProposalDto>.Ok(dto, approved ? "Proposal approved." : "Proposal rejected."));
    }
}
