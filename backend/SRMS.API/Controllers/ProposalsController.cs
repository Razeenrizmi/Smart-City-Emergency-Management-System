using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.Dtos;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

public class ProposalsController(SrmsDbContext db) : BaseApiController
{
    // GET /api/proposals?status=pending|decided|all — defaults to pending,
    // which is what the React panel's approve/reject list shows.
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ProposalDto>>>> GetAll([FromQuery] string status = "pending")
    {
        var query = db.SignalTimingProposals
            .AsNoTracking()
            .Include(p => p.Intersection)
            .Include(p => p.SignalTimingDecision)
            .AsQueryable();

        query = status.ToLowerInvariant() switch
        {
            "decided" => query.Where(p => p.SignalTimingDecision != null),
            "all" => query,
            _ => query.Where(p => p.SignalTimingDecision == null),
        };

        var proposals = await query
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new ProposalDto(
                p.Id,
                p.IntersectionId,
                p.Intersection.Name,
                p.Justification,
                p.SafetyCheckStatus,
                p.SafetyCheckNotes,
                p.CreatedAt,
                p.SignalTimingDecision!.Decision,
                p.SignalTimingDecision!.DecidedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<ProposalDto>>.Ok(proposals));
    }

    [HttpPost("{id:guid}/approve")]
    public Task<ActionResult<ApiResponse<ProposalDto>>> Approve(Guid id) => Decide(id, "APPROVED");

    [HttpPost("{id:guid}/reject")]
    public Task<ActionResult<ApiResponse<ProposalDto>>> Reject(Guid id) => Decide(id, "REJECTED");

    // Real JWT auth isn't built yet, so there's no logged-in user to record
    // as the decider. Falls back to the seeded TrafficControlStaff account
    // as a stand-in "operator" until auth exists — a placeholder, not a
    // hardcoded workaround meant to stay.
    private async Task<ActionResult<ApiResponse<ProposalDto>>> Decide(Guid proposalId, string decision)
    {
        var proposal = await db.SignalTimingProposals
            .Include(p => p.Intersection)
            .Include(p => p.SignalTimingDecision)
            .FirstOrDefaultAsync(p => p.Id == proposalId);

        if (proposal is null)
        {
            return NotFound(ApiResponse<ProposalDto>.Fail("Proposal not found."));
        }

        if (proposal.SignalTimingDecision is not null)
        {
            return BadRequest(ApiResponse<ProposalDto>.Fail("This proposal already has a decision."));
        }

        var operatorUser = await db.Users.FirstOrDefaultAsync(u => u.Role == "TrafficControlStaff");
        if (operatorUser is null)
        {
            return StatusCode(500, ApiResponse<ProposalDto>.Fail("No TrafficControlStaff user found to record the decision."));
        }

        var now = DateTime.UtcNow;
        var signalTimingDecision = new SignalTimingDecision
        {
            Id = Guid.NewGuid(),
            ProposalId = proposal.Id,
            DecidedByUserId = operatorUser.Id,
            Decision = decision,
            DecidedAt = now,
        };
        db.SignalTimingDecisions.Add(signalTimingDecision);

        var workflowRun = await db.AgentWorkflowRuns.FirstOrDefaultAsync(r => r.Id == proposal.WorkflowRunId);
        if (workflowRun is not null)
        {
            workflowRun.Status = decision == "APPROVED" ? "COMPLETED" : "REJECTED";
            workflowRun.FinalOutcome = decision;
            workflowRun.CompletedAt = now;
        }

        await db.SaveChangesAsync();

        var dto = new ProposalDto(
            proposal.Id,
            proposal.IntersectionId,
            proposal.Intersection.Name,
            proposal.Justification,
            proposal.SafetyCheckStatus,
            proposal.SafetyCheckNotes,
            proposal.CreatedAt,
            signalTimingDecision.Decision,
            signalTimingDecision.DecidedAt);

        return Ok(ApiResponse<ProposalDto>.Ok(dto, decision == "APPROVED" ? "Proposal approved." : "Proposal rejected."));
    }
}
