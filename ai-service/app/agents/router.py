"""FastAPI router endpoints for the Signal Action Agent."""

from fastapi import APIRouter, Query, status
from app.agents.signal_action_agent import SignalActionAgent
from app.models.schemas import (
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
        "actions and NEVER directly modifies or executes traffic signals."
    ),
)
async def propose_signal_actions(
    request: SignalActionAgentRequest,
    mock_mode: bool = Query(
        default=False,
        description="If True, forces deterministic reasoning without invoking external Gemini LLM.",
    ),
) -> SignalActionProposalResponse:
    """Generate and validate a signal action proposal for an emergency session."""
    agent = SignalActionAgent()
    return await agent.run(request=request, mock_mode=mock_mode)
