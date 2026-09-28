"""Unit and integration tests for the Signal Action Agent.

Tests cover:
1. Valid emergency route -> valid signal proposal (status: PROPOSED).
2. Empty junction list -> rejected (status: REJECTED).
3. Junction outside selected route -> rejected.
4. Out-of-order junction sequence -> rejected.
5. Disallowed signal action -> rejected.
6. Proposal does not execute any signal changes (strictly PROPOSED).
7. FastAPI HTTP endpoint test for signal proposal generation.
8. FastAPI HTTP endpoint test for rejected proposal handling.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.agents.signal_action_agent import SignalActionAgent
from app.main import app
from app.models.schemas import (
    JunctionAction,
    JunctionInput,
    ProposalStatus,
    SignalActionAgentRequest,
    SignalActionType,
)
from app.services.gemini_service import DEFAULT_TEST_FALLBACK_HOLD_SECONDS
from app.tools.validator import validate_signal_action_proposal


@pytest.fixture
def valid_request() -> SignalActionAgentRequest:
    """Fixture providing a standard valid emergency corridor request."""
    return SignalActionAgentRequest(
        emergency_session_id="sess_123e4567-e89b-12d3-a456-426614174000",
        vehicle_id="AMB-01",
        vehicle_type="Ambulance",
        route_id="route_colombo_kandy_01",
        route_name="Colombo to Kandy Priority Corridor",
        ordered_junctions=[
            JunctionInput(
                junction_id="junc_01",
                junction_name="Main Street & 1st Avenue",
                sequence_order=1,
                distance_meters=250.0,
                current_signal_state="RED",
            ),
            JunctionInput(
                junction_id="junc_02",
                junction_name="Main Street & Central Cross",
                sequence_order=2,
                distance_meters=600.0,
                current_signal_state="GREEN",
            ),
            JunctionInput(
                junction_id="junc_03",
                junction_name="Hospital Gate West",
                sequence_order=3,
                distance_meters=1100.0,
                current_signal_state="RED",
            ),
        ],
    )


@pytest.mark.asyncio
async def test_valid_emergency_route_produces_valid_proposal(
    valid_request: SignalActionAgentRequest,
):
    """Test 1: Valid emergency route produces a valid signal action proposal."""
    agent = SignalActionAgent(default_mock_mode=True)
    response = await agent.run(valid_request)

    assert response.proposal_status == ProposalStatus.PROPOSED
    assert response.emergency_session_id == valid_request.emergency_session_id
    assert response.route_id == valid_request.route_id
    assert len(response.proposed_junction_actions) == 3

    # Verify every junction was addressed in proper sequence
    for i, action in enumerate(response.proposed_junction_actions):
        expected_junction = valid_request.ordered_junctions[i]
        assert action.junction_id == expected_junction.junction_id
        assert action.sequence_order == expected_junction.sequence_order
        assert action.target_signal_state == "GREEN"
        assert action.hold_duration_seconds == DEFAULT_TEST_FALLBACK_HOLD_SECONDS
        assert "[Test/Demo Fallback]" in action.reason

    assert any("VALIDATION PASSED" in note for note in response.validation_notes)
    assert any("TOOL_DATA" in note for note in response.validation_notes)
    assert "[Test/Demo Fallback]" in response.reason


@pytest.mark.asyncio
async def test_empty_junction_list_rejected():
    """Test 2: Request with an empty junction list is rejected."""
    empty_request = SignalActionAgentRequest(
        emergency_session_id="sess_empty_001",
        vehicle_id="FIRE-09",
        vehicle_type="Fire Truck",
        route_id="route_empty",
        route_name="Empty Route Corridor",
        ordered_junctions=[],
    )

    agent = SignalActionAgent(default_mock_mode=True)
    response = await agent.run(empty_request)

    assert response.proposal_status == ProposalStatus.REJECTED
    assert len(response.proposed_junction_actions) == 0
    assert any("no junctions" in note.lower() for note in response.validation_notes)


def test_junction_outside_selected_route_rejected(valid_request: SignalActionAgentRequest):
    """Test 3: Proposed junction not belonging to the route is rejected."""
    bogus_actions = [
        JunctionAction(
            junction_id="junc_01",
            junction_name="Main Street & 1st Avenue",
            sequence_order=1,
            action=SignalActionType.PRIORITY_TRANSITION,
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Clear initial junction",
        ),
        JunctionAction(
            junction_id="junc_UNAUTHORIZED_99",
            junction_name="Unknown Off-Route Junction",
            sequence_order=2,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Unsafe action",
        ),
    ]

    report = validate_signal_action_proposal(
        input_junctions=valid_request.ordered_junctions,
        proposed_actions=bogus_actions,
        vehicle_type="Ambulance",
    )

    assert not report.is_valid
    assert report.status == ProposalStatus.REJECTED
    assert any("does not belong to the selected route" in note for note in report.notes)


def test_out_of_order_junction_sequence_rejected(valid_request: SignalActionAgentRequest):
    """Test 4: Proposed actions violating route sequence order are rejected."""
    reversed_actions = [
        JunctionAction(
            junction_id="junc_03",
            junction_name="Hospital Gate West",
            sequence_order=3,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=50,
            reason="Reversed arrival",
        ),
        JunctionAction(
            junction_id="junc_02",
            junction_name="Main Street & Central Cross",
            sequence_order=2,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Middle junction",
        ),
        JunctionAction(
            junction_id="junc_01",
            junction_name="Main Street & 1st Avenue",
            sequence_order=1,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=40,
            reason="First junction",
        ),
    ]

    report = validate_signal_action_proposal(
        input_junctions=valid_request.ordered_junctions,
        proposed_actions=reversed_actions,
        vehicle_type="Ambulance",
    )

    assert not report.is_valid
    assert report.status == ProposalStatus.REJECTED
    assert any("does not match route sequence order" in note for note in report.notes)


def test_invalid_signal_action_rejected(valid_request: SignalActionAgentRequest):
    """Test 5: An unapproved or disallowed signal action is rejected."""
    # Test disallowed action string
    disallowed_action = [
        JunctionAction.model_construct(
            junction_id="junc_01",
            junction_name="Main Street & 1st Avenue",
            sequence_order=1,
            action="UNAUTHORIZED_OVERRIDE",
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Illegal action",
        ),
        JunctionAction.model_construct(
            junction_id="junc_02",
            junction_name="Main Street & Central Cross",
            sequence_order=2,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Middle junction",
        ),
        JunctionAction.model_construct(
            junction_id="junc_03",
            junction_name="Hospital Gate West",
            sequence_order=3,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Third junction",
        ),
    ]

    report = validate_signal_action_proposal(
        input_junctions=valid_request.ordered_junctions,
        proposed_actions=disallowed_action,
        vehicle_type="Ambulance",
    )

    assert not report.is_valid
    assert report.status == ProposalStatus.REJECTED
    assert any("Disallowed signal action" in note for note in report.notes)

    # Test out-of-bounds hold duration
    out_of_bounds_action = [
        JunctionAction.model_construct(
            junction_id="junc_01",
            junction_name="Main Street & 1st Avenue",
            sequence_order=1,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Clear initial junction",
        ),
        JunctionAction.model_construct(
            junction_id="junc_02",
            junction_name="Main Street & Central Cross",
            sequence_order=2,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=500,  # Exceeds safe bounds (> 300)
            reason="Unsafe hold time",
        ),
        JunctionAction.model_construct(
            junction_id="junc_03",
            junction_name="Hospital Gate West",
            sequence_order=3,
            action=SignalActionType.GREEN_CORRIDOR,
            target_signal_state="GREEN",
            hold_duration_seconds=45,
            reason="Clear third junction",
        ),
    ]

    report_oob = validate_signal_action_proposal(
        input_junctions=valid_request.ordered_junctions,
        proposed_actions=out_of_bounds_action,
        vehicle_type="Ambulance",
    )

    assert not report_oob.is_valid
    assert report_oob.status == ProposalStatus.REJECTED
    assert any("safe simulation bounds" in note for note in report_oob.notes)


@pytest.mark.asyncio
async def test_proposal_does_not_execute_signal_changes(
    valid_request: SignalActionAgentRequest,
):
    """Test 6: Proposal status must strictly remain PROPOSED and never executed."""
    agent = SignalActionAgent(default_mock_mode=True)
    response = await agent.run(valid_request)

    # Core safety invariant
    assert response.proposal_status == ProposalStatus.PROPOSED
    assert response.proposal_status != "EXECUTED"
    assert response.proposal_status != "ACTIVE"
    # Ensure all actions are proposals with advisory information
    for action in response.proposed_junction_actions:
        assert isinstance(action.hold_duration_seconds, int)
        assert action.action in [
            SignalActionType.GREEN_CORRIDOR,
            SignalActionType.HOLD_RED,
            SignalActionType.PRIORITY_TRANSITION,
            SignalActionType.CAUTION_FLASH,
        ]


@pytest.mark.asyncio
async def test_fastapi_endpoint_propose_signals(valid_request: SignalActionAgentRequest):
    """Test 7: Propose signals via FastAPI HTTP endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/agent/propose-signals?mock_mode=true",
            json=valid_request.model_dump(),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["proposal_status"] == "PROPOSED"
        assert data["emergency_session_id"] == valid_request.emergency_session_id
        assert any("VALIDATION PASSED" in note for note in data["validation_notes"])
        assert any("TOOL_DATA" in note for note in data["validation_notes"])


@pytest.mark.asyncio
async def test_fastapi_endpoint_handles_rejected_proposal():
    """Test 8: Empty junction request sent to FastAPI returns rejected proposal."""
    empty_payload = {
        "emergency_session_id": "sess_reject_test",
        "vehicle_id": "POLICE-02",
        "vehicle_type": "Police",
        "route_id": "route_null",
        "route_name": "Zero Junction Route",
        "ordered_junctions": [],
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/agent/propose-signals?mock_mode=true",
            json=empty_payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["proposal_status"] == "REJECTED"
        assert len(data["proposed_junction_actions"]) == 0
        assert any("no junctions" in note.lower() for note in data["validation_notes"])


@pytest.mark.asyncio
@pytest.mark.parametrize("vehicle_type", ["Ambulance", "Fire Truck", "Police"])
async def test_mock_fallback_behavior_across_vehicle_types(
    valid_request: SignalActionAgentRequest,
    vehicle_type: str,
):
    """Test 9: Mock mode uses neutral test fallback behavior rather than invented domain rules."""
    req = valid_request.model_copy(update={"vehicle_type": vehicle_type})
    agent = SignalActionAgent(default_mock_mode=True)
    response = await agent.run(req)

    assert response.proposal_status == ProposalStatus.PROPOSED
    assert "[Test/Demo Fallback]" in response.reason
    assert "does not represent project traffic-control policy" in response.reason

    for action in response.proposed_junction_actions:
        assert action.hold_duration_seconds == DEFAULT_TEST_FALLBACK_HOLD_SECONDS
        assert "[Test/Demo Fallback]" in action.reason

