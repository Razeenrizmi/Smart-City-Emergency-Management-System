"""Pydantic foundation schemas for the Emergency Green Wave AI Service.

Defines the contract for the Signal Action Agent:
- Input: Emergency vehicle context, route details, ordered junctions, current signal states.
- Output: Structured signal action proposal marked strictly as PROPOSED (never executed).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    """Schema for service health check response."""

    status: str = Field(..., description="Overall service status")
    service: str = Field(..., description="Service identifier name")
    version: str = Field(..., description="Service version")
    gemini_configured: bool = Field(
        ..., description="Indicates whether the Gemini API key is configured"
    )


class SignalActionType(str, Enum):
    """Allowed signal action types for corridor clearance."""

    GREEN_CORRIDOR = "GREEN_CORRIDOR"
    HOLD_RED = "HOLD_RED"
    PRIORITY_TRANSITION = "PRIORITY_TRANSITION"
    CAUTION_FLASH = "CAUTION_FLASH"


class ApprovalStatus(str, Enum):
    """Explicit human approval status for an AI-generated signal action proposal."""

    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ProposalStatus(str, Enum):
    """Lifecycle status of an AI-generated signal action proposal."""

    PROPOSED = "PROPOSED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class WorkflowStatus(str, Enum):
    """Execution status of the LangGraph Signal Action Agent workflow."""

    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class JunctionInput(BaseModel):

    """Input telemetry for a junction along an emergency route."""

    junction_id: str = Field(..., description="Unique junction identifier (e.g., GUID or string ID)")
    junction_name: str = Field(..., description="Human-readable junction name")
    sequence_order: int = Field(..., ge=1, description="Order of this junction along the route (1-indexed)")
    distance_meters: Optional[float] = Field(
        default=None,
        ge=0,
        description="Distance from route origin or previous junction in meters",
    )
    current_signal_state: Optional[str] = Field(
        default="RED",
        description="Current signal state at the approach (RED, GREEN, YELLOW, UNKNOWN)",
    )


class SignalActionAgentRequest(BaseModel):
    """Input payload for the Signal Action Agent."""

    emergency_session_id: str = Field(
        ..., description="Unique ID of the emergency session from the simulation system"
    )
    vehicle_id: str = Field(..., description="Unique identifier of the emergency vehicle")
    vehicle_type: str = Field(
        ..., description="Type of emergency vehicle (e.g. Ambulance, Fire Truck, Police)"
    )
    route_id: str = Field(..., description="Selected route identifier")
    route_name: str = Field(..., description="Name of the selected route corridor")
    ordered_junctions: List[JunctionInput] = Field(
        default_factory=list,
        description="Ordered list of junctions the emergency vehicle will traverse",
    )
    current_signal_states: Optional[Dict[str, str]] = Field(
        default=None,
        description="Optional map of junction_id -> current signal state",
    )
    thread_id: Optional[str] = Field(
        default=None,
        description="Optional stable execution thread ID for checkpointing and state tracking",
    )



class JunctionAction(BaseModel):
    """Proposed non-destructive signal action for an individual junction."""

    junction_id: str = Field(..., description="Unique junction identifier")
    junction_name: str = Field(..., description="Junction name")
    sequence_order: int = Field(..., ge=1, description="Order along route")
    action: SignalActionType = Field(
        ..., description="Recommended clearing action (e.g. GREEN_CORRIDOR, HOLD_RED)"
    )
    target_signal_state: str = Field(
        default="GREEN",
        description="Target signal state for the emergency vehicle approach",
    )
    hold_duration_seconds: int = Field(
        ...,
        ge=5,
        le=300,
        description="Recommended clearance hold duration in seconds",
    )
    reason: str = Field(
        ..., description="Specific justification for this junction's signal recommendation"
    )


class SignalActionProposalResponse(BaseModel):
    """Structured proposal returned by the Signal Action Agent.

    IMPORTANT SAFETY INVARIANT:
    The AI agent NEVER directly executes traffic signal changes.
    The response status must be PROPOSED (or REJECTED), leaving execution
    and safety verification to the existing ASP.NET Core Green Wave backend.
    """

    proposal_id: str = Field(..., description="Unique proposal identifier")
    emergency_session_id: str = Field(..., description="Emergency session identifier")
    route_id: str = Field(..., description="Route identifier")
    route_name: str = Field(..., description="Route corridor name")
    vehicle_id: str = Field(..., description="Emergency vehicle identifier")
    vehicle_type: str = Field(..., description="Emergency vehicle type")
    proposal_status: ProposalStatus = Field(
        default=ProposalStatus.PROPOSED,
        description="Status of the proposal (PROPOSED, PENDING_APPROVAL, APPROVED, REJECTED). Never executed.",
    )
    approval_status: ApprovalStatus = Field(
        default=ApprovalStatus.PENDING_APPROVAL,
        description="Human approval status (PENDING_APPROVAL, APPROVED, REJECTED).",
    )
    handoff_ready: bool = Field(
        default=False,
        description="Indicates whether this proposal is approved and ready for safe handoff to the ASP.NET execution layer.",
    )
    approved_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp when human approval was granted",
    )
    approved_by: Optional[str] = Field(
        default=None,
        description="Identifier of operator or role that granted approval or rejection",
    )
    approval_notes: Optional[str] = Field(
        default=None,
        description="Notes or audit comments from the human approver",
    )
    workflow_status: Optional[WorkflowStatus] = Field(
        default=None,
        description="Workflow execution status (RUNNING, COMPLETED, REJECTED, FAILED)",
    )
    thread_id: Optional[str] = Field(
        default=None,
        description="LangGraph checkpoint thread identifier",
    )
    proposed_junction_actions: List[JunctionAction] = Field(
        default_factory=list,
        description="Ordered list of proposed junction clearing actions",
    )
    reason: str = Field(
        ..., description="Overall reasoning justifying the corridor clearing strategy"
    )
    validation_notes: List[str] = Field(
        default_factory=list,
        description="Audit and validation notes verifying adherence to route and safety rules",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when the proposal was generated",
    )


class CheckpointStateResponse(BaseModel):
    """Schema for retrieved LangGraph checkpointed state."""

    thread_id: str = Field(..., description="Stable execution thread identifier")
    checkpoint_id: Optional[str] = Field(default=None, description="Unique checkpoint version ID")
    workflow_status: str = Field(..., description="Workflow status: RUNNING, COMPLETED, REJECTED, FAILED")
    current_stage: Optional[str] = Field(default=None, description="Last recorded workflow stage")
    emergency_session_id: Optional[str] = Field(default=None, description="Associated emergency session ID")
    route_id: Optional[str] = Field(default=None, description="Route identifier")
    route_name: Optional[str] = Field(default=None, description="Route name")
    vehicle_id: Optional[str] = Field(default=None, description="Emergency vehicle identifier")
    vehicle_type: Optional[str] = Field(default=None, description="Emergency vehicle type")
    retrieved_route: Optional[Dict[str, Any]] = Field(default=None, description="Retrieved route context telemetry")
    retrieved_junctions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Retrieved ordered junctions")
    retrieved_signal_states: Optional[Dict[str, str]] = Field(default=None, description="Retrieved approach signal states")
    proposed_actions: Optional[List[Dict[str, Any]]] = Field(default=None, description="Proposed non-destructive actions")
    validation_notes: List[str] = Field(default_factory=list, description="Validation and audit trail notes")
    is_valid: Optional[bool] = Field(default=None, description="Validation result boolean")
    proposal_status: Optional[str] = Field(default=None, description="PROPOSED, PENDING_APPROVAL, APPROVED, or REJECTED")
    approval_status: Optional[str] = Field(default=None, description="Approval status: PENDING_APPROVAL, APPROVED, REJECTED")
    handoff_ready: bool = Field(
        default=False,
        description="Safe execution boundary flag: ready for ASP.NET handoff only when approved",
    )
    approved_at: Optional[str] = Field(default=None, description="ISO timestamp of human approval")
    approved_by: Optional[str] = Field(default=None, description="Operator ID who approved or rejected")
    approval_notes: Optional[str] = Field(default=None, description="Operational notes from approval or rejection")
    error: Optional[str] = Field(default=None, description="Workflow execution error if any")
    raw_reasoning: Optional[str] = Field(default=None, description="Reasoning narrative summary")
    created_at: Optional[str] = Field(default=None, description="ISO timestamp of initial creation")
    updated_at: Optional[str] = Field(default=None, description="ISO timestamp of last update")
    signal_execution_performed: bool = Field(
        default=False,
        description="Safety invariant: AI agent NEVER performs signal execution or DB writes",
    )


class GreenWaveHandoffPayload(BaseModel):
    """Safe handoff payload prepared for ASP.NET Green Wave execution.

    CRITICAL SAFETY BOUNDARY:
    The AI Agent prepares and validates this structured data.
    The AI Agent NEVER executes signal changes or updates live signal databases.
    Only the ASP.NET Core execution layer may consume this payload to activate the green wave.
    """

    emergency_session_id: str = Field(..., description="Emergency session identifier")
    route_id: str = Field(..., description="Route corridor identifier")
    route_name: str = Field(..., description="Route corridor name")
    vehicle_id: str = Field(..., description="Emergency vehicle identifier")
    vehicle_type: str = Field(..., description="Emergency vehicle type")
    thread_id: str = Field(..., description="LangGraph workflow thread identifier")
    approval_status: ApprovalStatus = Field(
        default=ApprovalStatus.APPROVED,
        description="Must be APPROVED before handoff can occur",
    )
    handoff_ready: bool = Field(
        default=True,
        description="Indicates handoff is ready for consumption by ASP.NET execution layer",
    )
    approved_at: datetime = Field(..., description="Timestamp of human approval")
    approved_by: Optional[str] = Field(default=None, description="Approving operator ID")
    junction_actions: List[JunctionAction] = Field(
        default_factory=list,
        description="Approved ordered junction clearing actions",
    )
    reasoning_summary: str = Field(..., description="Corridor clearing reasoning summary")
    signal_execution_performed: bool = Field(
        default=False,
        description="Safety invariant: always False at AI boundary; execution left to ASP.NET",
    )


class ApprovalRequest(BaseModel):
    """Optional payload for human approval or rejection."""

    operator_id: Optional[str] = Field(
        default=None,
        description="Identifier of the traffic operator approving or rejecting",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Operational audit notes or justification",
    )


class ApprovalActionResponse(BaseModel):
    """Response returned upon approving or rejecting a proposal."""

    thread_id: str = Field(..., description="Workflow execution thread ID")
    approval_status: ApprovalStatus = Field(..., description="PENDING_APPROVAL, APPROVED, REJECTED")
    proposal_status: ProposalStatus = Field(..., description="Updated proposal status")
    is_valid: bool = Field(..., description="Whether proposal passed deterministic validation")
    handoff_ready: bool = Field(..., description="Whether ready for ASP.NET execution handoff")
    signal_execution_performed: bool = Field(
        default=False,
        description="Safety invariant: AI agent NEVER performs signal execution",
    )
    approved_at: Optional[datetime] = Field(default=None, description="Timestamp of approval")
    approved_by: Optional[str] = Field(default=None, description="Operator ID")
    approval_notes: Optional[str] = Field(default=None, description="Operator notes")
    proposal: Optional[SignalActionProposalResponse] = Field(
        default=None,
        description="Full proposal details with updated approval metadata",
    )
    handoff_payload: Optional[GreenWaveHandoffPayload] = Field(
        default=None,
        description="Safe handoff payload populated only when APPROVED",
    )
    message: str = Field(..., description="Human-readable outcome message")

