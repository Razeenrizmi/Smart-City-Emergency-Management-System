"""Focused tests for Phase 5: Human Approval + Safe Execution Boundary.

Verifies:
1. Valid proposal starts as PENDING_APPROVAL with handoff_ready=False.
2. Valid proposal can be approved, generating safe handoff payload for ASP.NET layer.
3. Valid proposal can be rejected, preventing execution handoff.
4. Rejected proposal cannot be approved.
5. Invalid or unvalidated proposal cannot be approved.
6. Safety boundary: AI agent NEVER performs signal execution during approval (signal_execution_performed remains False).
7. Approval status persists through SQLite checkpointing across fresh agent instances.
8. FastAPI approval and rejection endpoints (/approve/{thread_id}, /reject/{thread_id}).
9. Phase 1-4 behavior remains intact (proposal-only, read-only tools, checkpointing).
"""

import os
import sqlite3
import pytest
from httpx import ASGITransport, AsyncClient

from app.agents.signal_action_agent import SignalActionAgent
from app.main import app
from app.models.schemas import (
    ApprovalActionResponse,
    ApprovalRequest,
    ApprovalStatus,
    JunctionInput,
    ProposalStatus,
    SignalActionAgentRequest,
    SignalActionProposalResponse,
    WorkflowStatus,
)


@pytest.fixture
def sample_request() -> SignalActionAgentRequest:
    """Fixture providing a standard valid emergency corridor request."""
    return SignalActionAgentRequest(
        emergency_session_id="sess_phase5_test_001",
        vehicle_id="AMB-501",
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
                junction_name="Main Street & 2nd Avenue",
                sequence_order=2,
                distance_meters=600.0,
                current_signal_state="RED",
            ),
            JunctionInput(
                junction_id="junc_03",
                junction_name="Central Expressway Crossing",
                sequence_order=3,
                distance_meters=1100.0,
                current_signal_state="RED",
            ),
        ],
    )


# ---------------------------------------------------------------------------
# 1. Valid proposal starts as PENDING_APPROVAL
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_valid_proposal_starts_as_pending_approval(sample_request, tmp_path):
    """Test 1: Every successfully validated Signal Action proposal initially has PENDING_APPROVAL status."""
    db_path = str(tmp_path / "checkpoints_pending.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_pending_001"

    response = await agent.run(sample_request, thread_id=thread_id)

    # Output response checks
    assert response.approval_status == ApprovalStatus.PENDING_APPROVAL
    assert response.handoff_ready is False
    assert response.approved_at is None
    assert response.approved_by is None

    # Checkpointed state checks
    state = agent.get_state(thread_id)
    assert state is not None
    assert state.get("approval_status") == ApprovalStatus.PENDING_APPROVAL.value
    assert state.get("handoff_ready") is False
    assert state.get("is_valid") is True
    assert state.get("signal_execution_performed") is False


# ---------------------------------------------------------------------------
# 2. Valid proposal can be approved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_valid_proposal_can_be_approved(sample_request, tmp_path):
    """Test 2: Valid proposal transitions to APPROVED and exposes safe handoff payload."""
    db_path = str(tmp_path / "checkpoints_approve.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_approve_001"

    await agent.run(sample_request, thread_id=thread_id)

    approval_res: ApprovalActionResponse = agent.approve(
        thread_id=thread_id,
        operator_id="operator_sarah",
        notes="Corridor clear, approving green wave handoff.",
    )

    assert approval_res.approval_status == ApprovalStatus.APPROVED
    assert approval_res.proposal_status == ProposalStatus.APPROVED
    assert approval_res.is_valid is True
    assert approval_res.handoff_ready is True
    assert approval_res.approved_by == "operator_sarah"
    assert approval_res.approved_at is not None
    assert "Corridor clear" in (approval_res.approval_notes or "")

    # Safe handoff payload checks
    handoff = approval_res.handoff_payload
    assert handoff is not None
    assert handoff.handoff_ready is True
    assert handoff.approval_status == ApprovalStatus.APPROVED
    assert handoff.emergency_session_id == sample_request.emergency_session_id
    assert handoff.route_id == sample_request.route_id
    assert handoff.vehicle_id == sample_request.vehicle_id
    assert len(handoff.junction_actions) == 3
    assert handoff.signal_execution_performed is False


# ---------------------------------------------------------------------------
# 3. Valid proposal can be rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_valid_proposal_can_be_rejected(sample_request, tmp_path):
    """Test 3: Valid proposal can be rejected by human operator."""
    db_path = str(tmp_path / "checkpoints_reject.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_reject_001"

    await agent.run(sample_request, thread_id=thread_id)

    rejection_res: ApprovalActionResponse = agent.reject(
        thread_id=thread_id,
        operator_id="operator_dave",
        notes="High congestion detected on side approaches. Rejecting clearance.",
    )

    assert rejection_res.approval_status == ApprovalStatus.REJECTED
    assert rejection_res.proposal_status == ProposalStatus.REJECTED
    assert rejection_res.handoff_ready is False
    assert rejection_res.handoff_payload is None
    assert rejection_res.approved_by == "operator_dave"
    assert rejection_res.approved_at is None

    # State in SQLite
    state = agent.get_state(thread_id)
    assert state.get("approval_status") == ApprovalStatus.REJECTED.value
    assert state.get("handoff_ready") is False


# ---------------------------------------------------------------------------
# 4. Rejected proposal cannot be approved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rejected_proposal_cannot_be_approved(sample_request, tmp_path):
    """Test 4: Once a proposal is rejected, approval is strictly forbidden."""
    db_path = str(tmp_path / "checkpoints_rejected_lock.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_rejected_lock_001"

    await agent.run(sample_request, thread_id=thread_id)
    agent.reject(thread_id=thread_id, notes="Operator rejection.")

    with pytest.raises(ValueError, match="already rejected"):
        agent.approve(thread_id=thread_id, operator_id="operator_late")


# ---------------------------------------------------------------------------
# 5. Invalid/unvalidated proposal cannot be approved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalid_or_unvalidated_proposal_cannot_be_approved(tmp_path):
    """Test 5: Proposals that fail deterministic validation or don't exist cannot be approved."""
    db_path = str(tmp_path / "checkpoints_invalid.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)

    # 1. Non-existent thread ID
    with pytest.raises(ValueError, match="No checkpoint state found"):
        agent.approve(thread_id="non_existent_thread_xyz")

    # 2. Proposal with empty junctions that fails deterministic validation
    invalid_request = SignalActionAgentRequest(
        emergency_session_id="sess_invalid_seq",
        vehicle_id="AMB-999",
        vehicle_type="Ambulance",
        route_id="route_empty",
        route_name="Empty Route Corridor",
        ordered_junctions=[],
    )
    thread_id = "thread_invalid_validation_001"
    res = await agent.run(invalid_request, thread_id=thread_id)
    assert res.proposal_status == ProposalStatus.REJECTED

    # Attempting to approve must fail
    with pytest.raises(ValueError, match="Cannot approve proposal"):
        agent.approve(thread_id=thread_id)


# ---------------------------------------------------------------------------
# 6. Safety Boundary: No signal execution occurs during approval
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_signal_execution_occurs_during_approval(sample_request, tmp_path):
    """Test 6: The AI Agent boundary is preserved: approval does NOT modify signal state or call execution APIs."""
    db_path = str(tmp_path / "checkpoints_safety.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_safety_boundary_001"

    await agent.run(sample_request, thread_id=thread_id)
    approval = agent.approve(thread_id=thread_id, operator_id="safety_auditor")

    assert approval.signal_execution_performed is False
    assert approval.handoff_payload.signal_execution_performed is False

    state = agent.get_state(thread_id)
    assert state.get("signal_execution_performed") is False


# ---------------------------------------------------------------------------
# 7. Approval state persists through SQLite
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_approval_state_persists_through_sqlite(sample_request, tmp_path):
    """Test 7: Approval status and handoff metadata persist to disk across fresh agent instances."""
    db_path = str(tmp_path / "checkpoints_persist_check.sqlite")
    thread_id = "thread_sqlite_persist_001"

    # Instance 1: Generate and approve
    agent_1 = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    await agent_1.run(sample_request, thread_id=thread_id)
    agent_1.approve(thread_id=thread_id, operator_id="operator_inst1", notes="Approved on node 1")

    # Instance 2: Brand new agent instance querying SQLite
    agent_2 = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    persisted_state = agent_2.get_state(thread_id)

    assert persisted_state is not None
    assert persisted_state.get("approval_status") == ApprovalStatus.APPROVED.value
    assert persisted_state.get("handoff_ready") is True
    assert persisted_state.get("approved_by") == "operator_inst1"
    assert persisted_state.get("approval_notes") == "Approved on node 1"
    assert persisted_state.get("signal_execution_performed") is False


# ---------------------------------------------------------------------------
# 8. FastAPI Endpoints for Approval and Rejection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fastapi_approve_and_reject_endpoints(sample_request):
    """Test 8: POST /api/v1/agent/approve/{thread_id} and POST /api/v1/agent/reject/{thread_id}."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Case A: Approve workflow via FastAPI
        thread_a = "fastapi_approval_thread_01"
        prop_a = await client.post(
            f"/api/v1/agent/propose-signals?mock_mode=true&thread_id={thread_a}",
            json=sample_request.model_dump(),
        )
        assert prop_a.status_code == 200
        assert prop_a.json()["approval_status"] == "PENDING_APPROVAL"

        approve_resp = await client.post(
            f"/api/v1/agent/approve/{thread_a}",
            json={"operator_id": "api_operator", "notes": "Approved through Web API"},
        )
        assert approve_resp.status_code == 200
        approve_data = approve_resp.json()
        assert approve_data["approval_status"] == "APPROVED"
        assert approve_data["handoff_ready"] is True
        assert approve_data["handoff_payload"] is not None
        assert approve_data["handoff_payload"]["handoff_ready"] is True
        assert approve_data["signal_execution_performed"] is False

        # Verify state endpoint also reflects approval
        state_resp = await client.get(f"/api/v1/agent/state/{thread_a}")
        assert state_resp.status_code == 200
        assert state_resp.json()["approval_status"] == "APPROVED"
        assert state_resp.json()["handoff_ready"] is True

        # Case B: 404 for unknown thread
        not_found = await client.post("/api/v1/agent/approve/unknown_thread_12345")
        assert not_found.status_code == 404

        # Case C: Reject workflow via FastAPI and prevent subsequent approval
        thread_b = "fastapi_rejection_thread_02"
        prop_b = await client.post(
            f"/api/v1/agent/propose-signals?mock_mode=true&thread_id={thread_b}",
            json=sample_request.model_dump(),
        )
        assert prop_b.status_code == 200

        reject_resp = await client.post(
            f"/api/v1/agent/reject/{thread_b}",
            json={"operator_id": "api_operator", "notes": "Rejected due to route diversion"},
        )
        assert reject_resp.status_code == 200
        assert reject_resp.json()["approval_status"] == "REJECTED"
        assert reject_resp.json()["handoff_ready"] is False

        # Attempt to approve rejected proposal -> 400 Bad Request
        re_approve = await client.post(f"/api/v1/agent/approve/{thread_b}")
        assert re_approve.status_code == 400


# ---------------------------------------------------------------------------
# 9. Phase 1–4 Behavior Remains Intact
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_existing_phase_1_to_4_behavior_intact(sample_request, tmp_path):
    """Test 9: Phase 1-4 contracts remain strictly intact alongside Phase 5 human approval additions."""
    db_path = str(tmp_path / "checkpoints_phase1_4.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_phase1_4_intact"

    response = await agent.run(sample_request, thread_id=thread_id)

    # Phase 1: proposal_status is PROPOSED
    assert response.proposal_status == ProposalStatus.PROPOSED
    assert len(response.proposed_junction_actions) == 3

    # Phase 2: read-only tools populated notes
    assert any("TOOL_DATA" in n for n in response.validation_notes)

    # Phase 3: reasoning generated
    assert len(response.reason) > 0

    # Phase 4: LangGraph workflow completed and persistent in SQLite
    assert response.workflow_status == WorkflowStatus.COMPLETED
    assert response.thread_id == thread_id

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?", (thread_id,))
    count = cur.fetchone()[0]
    conn.close()
    assert count > 0

    # Phase 5: initially PENDING_APPROVAL
    assert response.approval_status == ApprovalStatus.PENDING_APPROVAL
    assert response.handoff_ready is False
