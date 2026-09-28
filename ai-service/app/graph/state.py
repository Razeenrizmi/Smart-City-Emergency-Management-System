"""State schema for the Signal Action Agent workflow."""

from typing import Any, Dict, List, Optional, TypedDict
from app.models.schemas import (
    ApprovalStatus,
    JunctionAction,
    ProposalStatus,
    SignalActionAgentRequest,
    SignalActionProposalResponse,
    WorkflowStatus,
)


class AgentState(TypedDict, total=False):
    """Execution state passed through the Signal Action Agent graph stages.

    Preserves useful workflow state across all stages:
    - Execution tracking (thread_id, workflow_status, current_stage)
    - Route and vehicle telemetry (emergency_session_id, route_id, vehicle_id)
    - Retrieved tool context (route context, ordered junctions, signal states)
    - Reasoning and proposed actions
    - Validation results and notes
    - Human approval and safe execution boundary tracking (Phase 5)
    - Final advisory proposal response

    NEVER stores secrets, credentials, API keys, or driver PII.
    """

    # Execution tracking & checkpoint identity (Phase 4)
    thread_id: str
    workflow_status: str  # RUNNING, COMPLETED, REJECTED, FAILED
    current_stage: str
    created_at: str
    updated_at: str
    signal_execution_performed: bool

    # Human approval & safe execution boundary tracking (Phase 5)
    approval_status: str  # PENDING_APPROVAL, APPROVED, REJECTED
    handoff_ready: bool
    approved_at: Optional[str]
    approved_by: Optional[str]
    approval_notes: Optional[str]

    # Identifiers extracted from request
    emergency_session_id: str
    route_id: str
    route_name: Optional[str]
    vehicle_id: str
    vehicle_type: str

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

    # 5. Structured proposal stage outputs
    proposed_actions: List[JunctionAction]
    overall_reason: str
    proposal_status: ProposalStatus

    # 6. Validation stage outputs
    is_valid: bool
    validation_notes: List[str]
    final_response: SignalActionProposalResponse
