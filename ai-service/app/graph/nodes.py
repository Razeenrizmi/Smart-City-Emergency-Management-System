import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.graph.state import AgentState
from app.models.schemas import (
    JunctionAction,
    JunctionInput,
    ProposalStatus,
    SignalActionProposalResponse,
    SignalActionType,
)
from app.services.gemini_service import GeminiService
from app.tools.route_tools import (
    ReadOnlyCorridorToolClient,
)
from app.tools.validator import validate_signal_action_proposal

logger = logging.getLogger(__name__)


async def input_context_node(state: AgentState) -> AgentState:
    """Stage 1: Context Preparation.

    Validates presence of input payload and prepares normalized junction and vehicle context.
    """
    request = state.get("request")
    if not request:
        return {
            **state,
            "error": "Missing SignalActionAgentRequest in state.",
            "is_valid": False,
            "proposal_status": ProposalStatus.REJECTED,
        }

    # Normalize junctions sorted by sequence order
    sorted_junctions = sorted(request.ordered_junctions, key=lambda j: j.sequence_order)

    context: Dict[str, Any] = {
        "emergency_session_id": request.emergency_session_id,
        "vehicle_id": request.vehicle_id,
        "vehicle_type": request.vehicle_type,
        "route_id": request.route_id,
        "route_name": request.route_name,
        "total_junctions": len(sorted_junctions),
        "ordered_junctions": sorted_junctions,
    }

    return {
        **state,
        "context": context,
        "error": None,
    }


async def tool_retrieval_node(state: AgentState) -> AgentState:
    """Stage 2: Controlled Read-Only Tool Data Retrieval.

    Demonstrates controlled tool usage under the least-privilege boundary:
    1. Calls read-only tools to retrieve route context, ordered junctions, and signal states.
    2. Populates or enriches junction telemetry without any write or execution operations.
    3. If route context or junctions are missing or cannot be retrieved, records audit notes.
    """
    if state.get("error"):
        return state

    request = state["request"]
    tool_notes: List[str] = []
    tool_client = ReadOnlyCorridorToolClient()

    try:
        # Tool 1: Retrieve selected route context
        route_ctx = await tool_client.get_selected_route_context(request.route_id)

        # Tool 2: Retrieve ordered junctions along the route
        tool_junctions = await tool_client.get_ordered_route_junctions(request.route_id)

        # Tool 3: Retrieve current signal states along the corridor
        signal_states = await tool_client.get_junction_signal_states(request.route_id)

        retrieved_route_data = route_ctx.model_dump() if route_ctx else None
        retrieved_junctions_data = [j.model_dump() for j in tool_junctions]

        # If request did not supply ordered_junctions, populate from retrieved tool junctions
        effective_request = request
        if not request.ordered_junctions and tool_junctions:
            populated_junctions = [
                JunctionInput(
                    junction_id=j.junction_id,
                    junction_name=j.junction_name,
                    sequence_order=j.sequence_order,
                    distance_meters=j.distance_meters,
                    current_signal_state=signal_states.get(
                        j.junction_id, j.current_signal_state
                    ),
                )
                for j in tool_junctions
            ]
            effective_request = request.model_copy(
                update={"ordered_junctions": populated_junctions}
            )
            tool_notes.append(
                f"TOOL_DATA: Retrieved {len(populated_junctions)} ordered junctions for route '{request.route_id}' via read-only tools."
            )
        elif request.ordered_junctions:
            # If junctions were already provided in request, enrich signal states if available
            enriched_junctions = []
            for j in request.ordered_junctions:
                latest_signal = signal_states.get(
                    j.junction_id, j.current_signal_state or "RED"
                )
                enriched_junctions.append(
                    j.model_copy(update={"current_signal_state": latest_signal})
                )
            effective_request = request.model_copy(
                update={"ordered_junctions": enriched_junctions}
            )
            tool_notes.append(
                f"TOOL_DATA: Verified route '{request.route_id}' and refreshed signal states for {len(enriched_junctions)} junctions via read-only tools."
            )
        else:
            # Empty junctions in request AND nothing found by tools
            tool_notes.append(
                f"TOOL_WARNING: No junctions found for route '{request.route_id}' through read-only tools."
            )

        # Update context
        context = dict(state.get("context", {}))
        if route_ctx:
            context["route_name"] = route_ctx.route_name
            context["distance_km"] = route_ctx.distance_km
            context["traffic_level"] = route_ctx.traffic_level
        context["ordered_junctions"] = effective_request.ordered_junctions
        context["total_junctions"] = len(effective_request.ordered_junctions)

        return {
            **state,
            "request": effective_request,
            "context": context,
            "retrieved_route": retrieved_route_data,
            "retrieved_junctions": retrieved_junctions_data,
            "retrieved_signal_states": signal_states,
            "tool_retrieval_notes": tool_notes,
        }
    except Exception as e:
        logger.error("Error during tool retrieval stage: %s", e)
        return {
            **state,
            "error": f"Tool retrieval stage failed: {e}",
            "tool_retrieval_notes": [f"ERROR: Tool retrieval failed: {e}"],
        }


async def reasoning_node(state: AgentState) -> AgentState:
    """Stage 2: LLM / Deterministic Reasoning.

    Invokes Gemini (or deterministic engine in mock/offline mode) to formulate
    a coordinated signal clearance strategy for the vehicle corridor.
    """
    if state.get("error"):
        return state

    request = state["request"]
    mock_mode = state.get("mock_mode", False)

    gemini_service = GeminiService()
    reasoning_result = await gemini_service.generate_signal_actions(
        request=request,
        mock_mode=mock_mode,
    )

    return {
        **state,
        "raw_reasoning": reasoning_result.get("reasoning", ""),
        "raw_actions_data": reasoning_result.get("actions", []),
    }


async def structured_proposal_node(state: AgentState) -> AgentState:
    """Stage 3: Proposal Structuring.

    Converts raw model reasoning into structured JunctionAction domain objects.
    """
    if state.get("error"):
        return state

    raw_actions = state.get("raw_actions_data", [])
    proposed_actions: List[JunctionAction] = []
    parsing_notes: List[str] = []

    for item in raw_actions:
        try:
            # Map action string to enum safely
            action_str = str(item.get("action", "")).upper()
            action_type = SignalActionType(action_str)

            action_obj = JunctionAction(
                junction_id=str(item.get("junction_id", "")),
                junction_name=str(item.get("junction_name", "")),
                sequence_order=int(item.get("sequence_order", 0)),
                action=action_type,
                target_signal_state=str(item.get("target_signal_state", "GREEN")),
                hold_duration_seconds=int(item.get("hold_duration_seconds", 30)),
                reason=str(item.get("reason", "")),
            )
            proposed_actions.append(action_obj)
        except Exception as e:
            parsing_notes.append(f"Failed to parse action item {item}: {e}")

    return {
        **state,
        "proposed_actions": proposed_actions,
        "overall_reason": state.get("raw_reasoning", "Coordinated green corridor recommended."),
        "validation_notes": parsing_notes,
    }


async def validation_node(state: AgentState) -> AgentState:
    """Stage 4: Deterministic Validation.

    Enforces that all proposed actions belong to the route, follow sequence order,
    use allowed action types, and are marked strictly as PROPOSED.
    """
    request = state.get("request")
    proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    if not request or state.get("error"):
        error_msg = state.get("error") or "Unknown error before validation stage."
        rejected_response = SignalActionProposalResponse(
            proposal_id=proposal_id,
            emergency_session_id=request.emergency_session_id if request else "unknown",
            route_id=request.route_id if request else "unknown",
            route_name=request.route_name if request else "unknown",
            vehicle_id=request.vehicle_id if request else "unknown",
            vehicle_type=request.vehicle_type if request else "unknown",
            proposal_status=ProposalStatus.REJECTED,
            proposed_junction_actions=[],
            reason="Proposal generation aborted due to state error.",
            validation_notes=[f"ERROR: {error_msg}"],
            timestamp=now,
        )
        return {
            **state,
            "is_valid": False,
            "proposal_status": ProposalStatus.REJECTED,
            "final_response": rejected_response,
        }

    # Run deterministic safety validator
    proposed_actions = state.get("proposed_actions", [])
    report = validate_signal_action_proposal(
        input_junctions=request.ordered_junctions,
        proposed_actions=proposed_actions,
        vehicle_type=request.vehicle_type,
    )

    tool_notes = list(state.get("tool_retrieval_notes", []))
    combined_notes = tool_notes + list(state.get("validation_notes", [])) + report.notes

    final_response = SignalActionProposalResponse(
        proposal_id=proposal_id,
        emergency_session_id=request.emergency_session_id,
        route_id=request.route_id,
        route_name=request.route_name,
        vehicle_id=request.vehicle_id,
        vehicle_type=request.vehicle_type,
        proposal_status=report.status,
        proposed_junction_actions=report.validated_actions,
        reason=state.get("overall_reason", "Corridor clearing action plan."),
        validation_notes=combined_notes,
        timestamp=now,
    )

    return {
        **state,
        "is_valid": report.is_valid,
        "proposal_status": report.status,
        "validation_notes": combined_notes,
        "final_response": final_response,
    }
