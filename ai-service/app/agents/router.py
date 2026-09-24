"""FastAPI router endpoints for the Signal Action Agent with checkpoint state retrieval."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.agents.signal_action_agent import SignalActionAgent
from app.models.schemas import (
    ApprovalActionResponse,
    ApprovalRequest,
    CheckpointStateResponse,
    SignalActionAgentRequest,
    SignalActionProposalResponse,
)

router = APIRouter(prefix="/agent", tags=["Signal Action Agent"])


@router.post(
    "/propose-signals",
    response_model=SignalActionProposalResponse,
    status_code=status.HTTP_200_OK,
    summary="Propose traffic signal actions for an emergency vehicle route",
    description=(
        "Analyzes an emergency vehicle's route and ordered junctions to produce a "
        "structured signal clearing proposal. NOTE: This endpoint strictly PROPOSES "
        "actions and NEVER directly modifies or executes traffic signals. "
        "Persistently checkpoints workflow state to SQLite."
    ),
)
async def propose_signal_actions(
    request: SignalActionAgentRequest,
    mock_mode: bool = Query(
        default=False,
        description="If True, forces deterministic reasoning without invoking external Gemini LLM.",
    ),
    thread_id: Optional[str] = Query(
        default=None,
        description="Optional stable execution thread ID for checkpointing.",
    ),
) -> SignalActionProposalResponse:
    """Generate, validate, and checkpoint a signal action proposal for an emergency session."""
    agent = SignalActionAgent()
    return await agent.run(request=request, mock_mode=mock_mode, thread_id=thread_id)


@router.get(
    "/state/{thread_id}",
    response_model=CheckpointStateResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve persistent LangGraph workflow checkpoint state by thread ID",
    description=(
        "Returns the full checkpointed state of an emergency corridor workflow execution from SQLite. "
        "Allows inspection and state recovery beyond a single invocation."
    ),
)
async def get_checkpoint_state(thread_id: str) -> CheckpointStateResponse:
    """Retrieve checkpointed workflow state by stable thread identifier."""
    agent = SignalActionAgent()
    state = agent.get_state(thread_id)
    if not state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No checkpoint state found for thread_id '{thread_id}'.",
        )

    proposed_actions_raw = state.get("proposed_actions", [])
    formatted_actions = [
        a.model_dump() if hasattr(a, "model_dump") else a
        for a in proposed_actions_raw
    ]

    return CheckpointStateResponse(
        thread_id=thread_id,
        workflow_status=str(state.get("workflow_status", "UNKNOWN")),
        current_stage=state.get("current_stage"),
        emergency_session_id=state.get("emergency_session_id"),
        route_id=state.get("route_id"),
        route_name=state.get("route_name"),
        vehicle_id=state.get("vehicle_id"),
        vehicle_type=state.get("vehicle_type"),
        retrieved_route=state.get("retrieved_route"),
        retrieved_junctions=state.get("retrieved_junctions"),
        retrieved_signal_states=state.get("retrieved_signal_states"),
        proposed_actions=formatted_actions,
        validation_notes=state.get("validation_notes", []),
        is_valid=state.get("is_valid"),
        proposal_status=str(state.get("proposal_status")) if state.get("proposal_status") else None,
        approval_status=str(state.get("approval_status")) if state.get("approval_status") else None,
        handoff_ready=bool(state.get("handoff_ready", False)),
        approved_at=state.get("approved_at"),
        approved_by=state.get("approved_by"),
        approval_notes=state.get("approval_notes"),
        error=state.get("error"),
        raw_reasoning=state.get("raw_reasoning"),
        created_at=state.get("created_at"),
        updated_at=state.get("updated_at"),
        signal_execution_performed=False,
    )


@router.get(
    "/history/{thread_id}",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Retrieve checkpoint audit trail history by thread ID",
    description="Returns the sequential list of checkpoint snapshots recorded during graph execution.",
)
async def get_checkpoint_history(thread_id: str) -> List[Dict[str, Any]]:
    """Retrieve the checkpoint audit trail for a workflow execution."""
    agent = SignalActionAgent()
    history = agent.get_state_history(thread_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No checkpoint history found for thread_id '{thread_id}'.",
        )

    summary = []
    for snap in history:
        summary.append({
            "stage": snap.get("current_stage"),
            "workflow_status": snap.get("workflow_status"),
            "updated_at": snap.get("updated_at"),
            "is_valid": snap.get("is_valid"),
            "approval_status": snap.get("approval_status"),
            "handoff_ready": snap.get("handoff_ready"),
        })
    return summary


@router.post(
    "/approve/{thread_id}",
    response_model=ApprovalActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a validated Signal Action proposal by thread ID",
    description=(
        "Human approval gate: transitions a validated proposal from PENDING_APPROVAL to APPROVED. "
        "Generates a safe handoff payload for the ASP.NET Green Wave execution layer. "
        "SAFETY INVARIANT: AI agent NEVER modifies or executes signals directly."
    ),
)
async def approve_proposal(
    thread_id: str,
    request: Optional[ApprovalRequest] = None,
) -> ApprovalActionResponse:
    """Approve a signal action proposal by thread ID."""
    agent = SignalActionAgent()
    try:
        operator_id = request.operator_id if request else None
        notes = request.notes if request else None
        return agent.approve(thread_id=thread_id, operator_id=operator_id, notes=notes)
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower() or "no checkpoint" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )


@router.post(
    "/reject/{thread_id}",
    response_model=ApprovalActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a Signal Action proposal by thread ID",
    description=(
        "Human rejection gate: marks proposal as REJECTED in SQLite checkpoint. "
        "Rejected proposals cannot be approved or handed off for execution."
    ),
)
async def reject_proposal(
    thread_id: str,
    request: Optional[ApprovalRequest] = None,
) -> ApprovalActionResponse:
    """Reject a signal action proposal by thread ID."""
    agent = SignalActionAgent()
    try:
        operator_id = request.operator_id if request else None
        notes = request.notes if request else None
        return agent.reject(thread_id=thread_id, operator_id=operator_id, notes=notes)
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower() or "no checkpoint" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )
