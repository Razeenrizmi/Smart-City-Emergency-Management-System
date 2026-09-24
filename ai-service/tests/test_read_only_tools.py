"""Comprehensive tests for Phase 3: Controlled Read-Only Tools and Project Data Boundary.

Verifies:
1. Each tool is strictly read-only and forbids mutating operations.
2. Valid route/junction data can be retrieved from the project boundary.
3. Invalid or missing route data is handled safely without crashing.
4. Least privilege is enforced on all returned models.
5. The agent automatically retrieves and uses route/junction context when not provided.
6. The retrieved data reaches the reasoning stage and is validated deterministically.
7. Proposal status remains strictly PROPOSED (no signal execution occurs).
8. Real Gemini parsing path works seamlessly with structured response decoding.
"""

import json
from unittest.mock import AsyncMock, patch
import pytest
import httpx
from httpx import ASGITransport, AsyncClient

from app.agents.signal_action_agent import SignalActionAgent
from app.config import settings
from app.graph.workflow import signal_action_workflow
from app.main import app
from app.models.schemas import (
    JunctionInput,
    ProposalStatus,
    SignalActionAgentRequest,
    SignalActionType,
)
from app.services.gemini_service import GeminiService
from app.tools.route_tools import (
    OrderedRouteJunction,
    ReadOnlyCorridorToolClient,
    SelectedRouteContext,
    get_junction_signal_states,
    get_ordered_route_junctions,
    get_selected_route_context,
)


# Known test route IDs from the project seed data and simulation catalog
ROUTE_A_ID = "22222222-2222-2222-2222-222222222201"
ROUTE_B_ID = "22222222-2222-2222-2222-222222222202"
INVALID_ROUTE_ID = "00000000-0000-0000-0000-000000000000"


# ---------------------------------------------------------------------------
# 1. Read-Only Constraint & Security Tests
# ---------------------------------------------------------------------------

def test_tools_are_strictly_read_only():
    """Requirement 3 & 14: Tools must be strictly read-only."""
    client = ReadOnlyCorridorToolClient()

    # Verify read-only flag
    assert client.is_read_only is True

    # Verify that mutation methods raise PermissionError
    with pytest.raises(PermissionError) as exc_signal:
        client.execute_signal_change("junc_01", "GREEN")
    assert "execute_signal_change is forbidden" in str(exc_signal.value)

    with pytest.raises(PermissionError) as exc_wave:
        client.activate_green_wave("route_01")
    assert "activate_green_wave is forbidden" in str(exc_wave.value)

    with pytest.raises(PermissionError) as exc_emerg:
        client.complete_emergency("session_01")
    assert "complete_emergency is forbidden" in str(exc_emerg.value)


@pytest.mark.asyncio
async def test_tool_client_only_makes_get_requests():
    """Requirement 3: Verify that HTTP client inside the tools only issues GET requests."""
    requested_methods = []

    def mock_handler(request: httpx.Request):
        requested_methods.append(request.method)
        return httpx.Response(404, json={"detail": "Not found"})

    transport = httpx.MockTransport(mock_handler)
    client = ReadOnlyCorridorToolClient(base_url="http://mock-backend")

    # Patch httpx.AsyncClient to use our mock transport
    with patch("httpx.AsyncClient", return_value=httpx.AsyncClient(transport=transport)):
        await client.get_selected_route_context(ROUTE_A_ID)
        await client.get_ordered_route_junctions(ROUTE_A_ID)

    # All issued HTTP requests must strictly be GET
    assert len(requested_methods) > 0
    assert all(method == "GET" for method in requested_methods)


# ---------------------------------------------------------------------------
# 2. Tool Data Retrieval Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_retrieve_valid_route_context():
    """Requirement 2 & 14: Retrieve valid selected route context."""
    route_ctx = await get_selected_route_context(ROUTE_A_ID)

    assert route_ctx is not None
    assert isinstance(route_ctx, SelectedRouteContext)
    assert route_ctx.route_id == ROUTE_A_ID
    assert route_ctx.route_name == "Route A"
    assert route_ctx.start_location == "Peradeniya"
    assert route_ctx.destination == "Kandy"
    assert route_ctx.distance_km == 5.0
    assert route_ctx.traffic_level in ["HIGH", "MEDIUM", "LOW"]


@pytest.mark.asyncio
async def test_retrieve_ordered_junctions():
    """Requirement 2 & 14: Retrieve ordered junctions along a route."""
    junctions = await get_ordered_route_junctions(ROUTE_A_ID)

    assert len(junctions) == 4
    # Verify sequence order is strictly non-decreasing 1..4
    for i, junc in enumerate(junctions):
        assert isinstance(junc, OrderedRouteJunction)
        assert junc.sequence_order == i + 1
        assert len(junc.junction_id) > 0
        assert len(junc.junction_name) > 0
        assert junc.current_signal_state in ["GREEN", "RED", "YELLOW"]


@pytest.mark.asyncio
async def test_retrieve_junction_signal_states():
    """Requirement 2 & 14: Retrieve current signal states."""
    signal_states = await get_junction_signal_states(ROUTE_A_ID)

    assert isinstance(signal_states, dict)
    assert len(signal_states) == 4
    # In Route A: J01 and J02 are GREEN, J04 and J05 are RED
    assert "11111111-1111-1111-1111-111111111101" in signal_states
    assert signal_states["11111111-1111-1111-1111-111111111101"] == "GREEN"


@pytest.mark.asyncio
async def test_invalid_or_missing_route_handled_safely():
    """Requirement 14: Missing or invalid route is handled gracefully without exceptions."""
    route_ctx = await get_selected_route_context(INVALID_ROUTE_ID)
    assert route_ctx is None

    junctions = await get_ordered_route_junctions(INVALID_ROUTE_ID)
    assert junctions == []

    signal_states = await get_junction_signal_states(INVALID_ROUTE_ID)
    assert signal_states == {}


# ---------------------------------------------------------------------------
# 3. Least Privilege Enforcement Tests
# ---------------------------------------------------------------------------

def test_least_privilege_boundary_on_tool_models():
    """Requirement 4: Verify least privilege - models contain ONLY minimal required info."""
    route_fields = set(SelectedRouteContext.model_fields.keys())
    junction_fields = set(OrderedRouteJunction.model_fields.keys())

    # Sensitive or mutating fields that MUST NOT exist
    forbidden_fields = {
        "password",
        "secret",
        "driver_id",
        "driver_name",
        "driver_phone",
        "api_key",
        "database_connection",
        "is_admin",
        "can_override_signals",
    }

    assert route_fields.isdisjoint(forbidden_fields)
    assert junction_fields.isdisjoint(forbidden_fields)

    # Allowed least-privilege fields
    assert "route_id" in route_fields
    assert "route_name" in route_fields
    assert "distance_km" in route_fields
    assert "junction_id" in junction_fields
    assert "sequence_order" in junction_fields
    assert "current_signal_state" in junction_fields


# ---------------------------------------------------------------------------
# 4. Agent Tool Integration in LangGraph Workflow Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_automatically_retrieves_route_context_when_empty():
    """Requirement 7 & 14: Agent uses tool retrieval to populate empty junctions."""
    request_without_junctions = SignalActionAgentRequest(
        emergency_session_id="sess_tool_auto_001",
        vehicle_id="AMB-99",
        vehicle_type="Ambulance",
        route_id=ROUTE_A_ID,
        route_name="Route A Corridor",
        ordered_junctions=[],  # Caller passes empty list; agent must retrieve via tools
    )

    agent = SignalActionAgent(default_mock_mode=True)
    response = await agent.run(request_without_junctions)

    # Verify agent retrieved junctions and produced a valid proposal
    assert response.proposal_status == ProposalStatus.PROPOSED
    assert len(response.proposed_junction_actions) == 4
    assert any("TOOL_DATA" in note for note in response.validation_notes)
    assert any("Retrieved 4 ordered junctions" in note for note in response.validation_notes)
    assert any("VALIDATION PASSED" in note for note in response.validation_notes)

    # Verify junction order
    for idx, action in enumerate(response.proposed_junction_actions):
        assert action.sequence_order == idx + 1
        assert action.target_signal_state == "GREEN"


@pytest.mark.asyncio
async def test_agent_with_invalid_route_rejected():
    """Requirement 8 & 14: Agent rejects proposal when route has no junctions and cannot be found."""
    invalid_req = SignalActionAgentRequest(
        emergency_session_id="sess_invalid_route",
        vehicle_id="FIRE-01",
        vehicle_type="Fire Truck",
        route_id=INVALID_ROUTE_ID,
        route_name="Non-Existent Route",
        ordered_junctions=[],
    )

    agent = SignalActionAgent(default_mock_mode=True)
    response = await agent.run(invalid_req)

    assert response.proposal_status == ProposalStatus.REJECTED
    assert len(response.proposed_junction_actions) == 0
    assert any("no junctions" in note.lower() for note in response.validation_notes)


@pytest.mark.asyncio
async def test_retrieved_data_reaches_reasoning_stage():
    """Requirement 14: Confirm that retrieved data reaches the intermediate LangGraph state."""
    request = SignalActionAgentRequest(
        emergency_session_id="sess_flow_test",
        vehicle_id="POLICE-07",
        vehicle_type="Police",
        route_id=ROUTE_B_ID,
        route_name="Route B",
        ordered_junctions=[],
    )

    initial_state = {
        "request": request,
        "mock_mode": True,
    }

    final_state = await signal_action_workflow.ainvoke(initial_state)

    # Check stage outputs in graph state
    assert final_state.get("retrieved_route") is not None
    assert final_state["retrieved_route"]["route_name"] == "Route B"
    assert len(final_state.get("retrieved_junctions", [])) == 3
    assert len(final_state.get("retrieved_signal_states", {})) == 3
    assert len(final_state.get("tool_retrieval_notes", [])) > 0
    assert len(final_state.get("proposed_actions", [])) == 3
    assert final_state.get("is_valid") is True


# ---------------------------------------------------------------------------
# 5. Non-Execution Invariant Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_signal_execution_occurs():
    """Requirement 3, 10 & 14: AI service never executes signal changes."""
    # Record signal state before
    before_states = await get_junction_signal_states(ROUTE_A_ID)

    request = SignalActionAgentRequest(
        emergency_session_id="sess_no_exec",
        vehicle_id="AMB-50",
        vehicle_type="Ambulance",
        route_id=ROUTE_A_ID,
        route_name="Route A Corridor",
        ordered_junctions=[],
    )

    agent = SignalActionAgent(default_mock_mode=True)
    response = await agent.run(request)

    # Invariant 1: Proposal status must be PROPOSED, never EXECUTED or ACTIVE
    assert response.proposal_status == ProposalStatus.PROPOSED
    assert response.proposal_status != "EXECUTED"
    assert response.proposal_status != "ACTIVE"

    # Invariant 2: Signal states in the system were not modified by the AI tool
    after_states = await get_junction_signal_states(ROUTE_A_ID)
    assert before_states == after_states


# ---------------------------------------------------------------------------
# 6. Real Gemini Parsing & Integration Path Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_real_gemini_integration_response_parsing():
    """Requirement 13 & 14: Test real Gemini response parsing pipeline."""
    sample_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "reasoning": "Live Gemini reasoning: Cleared 3 corridor junctions via coordinated green wave.",
                                "actions": [
                                    {
                                        "junction_id": "junc_01",
                                        "junction_name": "Main Street & 1st Avenue",
                                        "sequence_order": 1,
                                        "action": "PRIORITY_TRANSITION",
                                        "target_signal_state": "GREEN",
                                        "hold_duration_seconds": 35,
                                        "reason": "Transitioning immediate approach from red to green",
                                    },
                                    {
                                        "junction_id": "junc_02",
                                        "junction_name": "Main Street & Central Cross",
                                        "sequence_order": 2,
                                        "action": "GREEN_CORRIDOR",
                                        "target_signal_state": "GREEN",
                                        "hold_duration_seconds": 40,
                                        "reason": "Maintaining green corridor at cross intersection",
                                    },
                                    {
                                        "junction_id": "junc_03",
                                        "junction_name": "Hospital Gate West",
                                        "sequence_order": 3,
                                        "action": "GREEN_CORRIDOR",
                                        "target_signal_state": "GREEN",
                                        "hold_duration_seconds": 45,
                                        "reason": "Clearing hospital approach",
                                    },
                                ],
                            })
                        }
                    ]
                }
            }
        ]
    }

    def mock_gemini_handler(request: httpx.Request):
        return httpx.Response(200, json=sample_gemini_payload)

    gemini_service = GeminiService(api_key="test-synthetic-key", model="gemini-2.5-flash")

    req = SignalActionAgentRequest(
        emergency_session_id="sess_gemini_test",
        vehicle_id="AMB-GEMINI",
        vehicle_type="Ambulance",
        route_id="route_colombo_kandy_01",
        route_name="Colombo to Kandy Priority Corridor",
        ordered_junctions=[
            JunctionInput(
                junction_id="junc_01",
                junction_name="Main Street & 1st Avenue",
                sequence_order=1,
                current_signal_state="RED",
            ),
            JunctionInput(
                junction_id="junc_02",
                junction_name="Main Street & Central Cross",
                sequence_order=2,
                current_signal_state="GREEN",
            ),
            JunctionInput(
                junction_id="junc_03",
                junction_name="Hospital Gate West",
                sequence_order=3,
                current_signal_state="RED",
            ),
        ],
    )

    with patch("httpx.AsyncClient", return_value=httpx.AsyncClient(transport=httpx.MockTransport(mock_gemini_handler))):
        result = await gemini_service.generate_signal_actions(req, mock_mode=False)

    assert "Live Gemini reasoning" in result["reasoning"]
    assert len(result["actions"]) == 3
    assert result["actions"][0]["hold_duration_seconds"] == 35


@pytest.mark.asyncio
async def test_live_gemini_api_when_key_configured():
    """Requirement 16: If Gemini API access is configured, execute live integration call."""
    if not settings.GEMINI_API_KEY:
        pytest.skip("GEMINI_API_KEY is not configured in environment or .env; skipping live API call.")

    service = GeminiService()
    req = SignalActionAgentRequest(
        emergency_session_id="sess_live_gemini",
        vehicle_id="AMB-01",
        vehicle_type="Ambulance",
        route_id="route_colombo_kandy_01",
        route_name="Colombo to Kandy Priority Corridor",
        ordered_junctions=[
            JunctionInput(
                junction_id="junc_01",
                junction_name="Main Street & 1st Avenue",
                sequence_order=1,
                current_signal_state="RED",
            )
        ],
    )

    proposal = await service.generate_signal_actions(req, mock_mode=False)
    assert "actions" in proposal
    assert len(proposal["actions"]) == 1
    assert proposal["actions"][0]["target_signal_state"] == "GREEN"
