"""State schema for the Signal Action Agent workflow."""

from typing import Any, Dict, List, Optional, TypedDict
from app.models.schemas import (
    JunctionAction,
    ProposalStatus,
    SignalActionAgentRequest,
    SignalActionProposalResponse,
)


class AgentState(TypedDict, total=False):
    """Execution state passed through the Signal Action Agent graph stages."""

    # 1. Input payload
    request: SignalActionAgentRequest

    # Configuration flags
    mock_mode: bool

    # 2. Context stage outputs
    context: Dict[str, Any]
    error: Optional[str]

    # 3. Tool retrieval stage outputs (Controlled Read-Only Tools)
    retrieved_route: Optional[Dict[str, Any]]
    retrieved_junctions: Optional[List[Dict[str, Any]]]
    retrieved_signal_states: Optional[Dict[str, str]]
    tool_retrieval_notes: Optional[List[str]]

    # 4. Reasoning stage outputs
    raw_reasoning: str
    raw_actions_data: List[Dict[str, Any]]

    # 4. Structured proposal stage outputs
    proposed_actions: List[JunctionAction]
    overall_reason: str
    proposal_status: ProposalStatus

    # 5. Validation stage outputs
    is_valid: bool
    validation_notes: List[str]
    final_response: SignalActionProposalResponse
