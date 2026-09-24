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


class ProposalStatus(str, Enum):
    """Lifecycle status of an AI-generated signal action proposal."""

    PROPOSED = "PROPOSED"
    REJECTED = "REJECTED"


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
        description="Status of the proposal (PROPOSED or REJECTED). Never executed.",
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
