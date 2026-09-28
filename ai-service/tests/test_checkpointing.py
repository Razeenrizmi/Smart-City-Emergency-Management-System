"""Comprehensive tests for Phase 4: Persistent LangGraph Workflow State & SQLite Checkpointing.

Verifies:
1. SQLite checkpoint persistence on disk (tables: checkpoints, writes).
2. Stable execution/thread identifier (thread_id).
3. State retrieval across separate invocations / process instances.
4. Thread isolation: two thread IDs remain completely isolated.
5. Successful workflow state semantics (RUNNING, COMPLETED, PROPOSED).
6. Rejected proposal state semantics (REJECTED, is_valid=False).
7. Failed workflow state handling.
8. Workflow resume and recovery from interrupted checkpoints.
9. Security boundary: zero secrets, API keys, credentials, or PII in checkpoint database.
10. Read-only tool restrictions remain strictly intact.
11. Validation deterministically occurs after proposal generation.
12. Proposal-only invariant: no signal execution occurs.
13. FastAPI state inspection endpoints (/state/{thread_id}, /history/{thread_id}).
"""

import os
import sqlite3
import pytest
from httpx import ASGITransport, AsyncClient

from app.agents.signal_action_agent import SignalActionAgent
from app.config import settings
from app.graph.workflow import (
    build_signal_action_graph,
    compile_signal_action_workflow,
    signal_action_workflow,
)
from app.main import app
from app.models.schemas import (
    JunctionInput,
    ProposalStatus,
    SignalActionAgentRequest,
    WorkflowStatus,
)
from app.tools.route_tools import ReadOnlyCorridorToolClient
from langgraph.checkpoint.sqlite import SqliteSaver


@pytest.fixture
def sample_request() -> SignalActionAgentRequest:
    """Fixture providing a standard valid emergency corridor request."""
    return SignalActionAgentRequest(
        emergency_session_id="sess_cp_test_12345",
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


# ---------------------------------------------------------------------------
# 1. SQLite Persistence & Table Structure
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sqlite_checkpoint_database_persistence(sample_request, tmp_path):
    """Test 1: Checkpoints are persistently written to SQLite database on disk."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)

    thread_id = "thread_persist_disk_001"
    response = await agent.run(sample_request, thread_id=thread_id)

    assert response.proposal_status == ProposalStatus.PROPOSED
    assert os.path.exists(db_path)
    assert os.path.getsize(db_path) > 0

    # Query SQLite database directly using sqlite3
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check checkpoints table exists and has rows for this thread
    cursor.execute("SELECT thread_id, checkpoint_id FROM checkpoints WHERE thread_id = ?", (thread_id,))
    checkpoint_rows = cursor.fetchall()
    assert len(checkpoint_rows) > 0, "Expected checkpoint rows in SQLite database"

    # Check writes table exists and has rows for this thread
    cursor.execute("SELECT thread_id, channel FROM writes WHERE thread_id = ?", (thread_id,))
    write_rows = cursor.fetchall()
    assert len(write_rows) > 0, "Expected write rows in SQLite database"

    conn.close()


# ---------------------------------------------------------------------------
# 2. Stable thread_id and State Retrieval
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stable_thread_id_state_retrieval(sample_request, tmp_path):
    """Test 2: A stable thread_id preserves workflow state and allows retrieval."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)

    stable_thread_id = "thread_stable_sess_42"
    response = await agent.run(sample_request, thread_id=stable_thread_id)

    assert response.thread_id == stable_thread_id
    assert response.workflow_status == WorkflowStatus.COMPLETED

    # Retrieve checkpoint state by stable thread_id
    state = agent.get_state(stable_thread_id)
    assert state is not None
    assert state.get("thread_id") == stable_thread_id
    assert state.get("emergency_session_id") == sample_request.emergency_session_id
    assert state.get("route_id") == sample_request.route_id
    assert state.get("vehicle_id") == sample_request.vehicle_id
    assert state.get("vehicle_type") == sample_request.vehicle_type
    assert state.get("workflow_status") == WorkflowStatus.COMPLETED.value
    assert state.get("current_stage") == "validation"
    assert state.get("is_valid") is True
    assert len(state.get("proposed_actions", [])) == 3
    assert state.get("signal_execution_performed") is False


# ---------------------------------------------------------------------------
# 3. Persistence Across Separate Instances
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_state_persistence_across_separate_instances(sample_request, tmp_path):
    """Test 3: Checkpointed state persists beyond the lifetime of a single agent instance."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    thread_id = "thread_reopen_test"

    # Instance 1: Executes workflow
    agent1 = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    res1 = await agent1.run(sample_request, thread_id=thread_id)
    assert res1.proposal_status == ProposalStatus.PROPOSED
    del agent1

    # Instance 2: Brand new instance opening the same SQLite file
    agent2 = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    state = agent2.get_state(thread_id)

    assert state is not None
    assert state["thread_id"] == thread_id
    assert state["emergency_session_id"] == sample_request.emergency_session_id
    assert state["workflow_status"] == WorkflowStatus.COMPLETED.value
    assert state["final_response"].proposal_id == res1.proposal_id


# ---------------------------------------------------------------------------
# 4. Thread Isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_thread_isolation_between_sessions(sample_request, tmp_path):
    """Test 4: Workflows under different thread IDs remain completely isolated."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)

    # Request A: Ambulance
    req_a = sample_request.model_copy(
        update={
            "emergency_session_id": "sess_A",
            "vehicle_id": "AMBULANCE-01",
            "vehicle_type": "Ambulance",
        }
    )
    thread_a = "thread_isolation_A"

    # Request B: Fire Truck on different session
    req_b = sample_request.model_copy(
        update={
            "emergency_session_id": "sess_B",
            "vehicle_id": "FIRE-09",
            "vehicle_type": "Fire Truck",
        }
    )
    thread_b = "thread_isolation_B"

    await agent.run(req_a, thread_id=thread_a)
    await agent.run(req_b, thread_id=thread_b)

    state_a = agent.get_state(thread_a)
    state_b = agent.get_state(thread_b)

    assert state_a is not None
    assert state_b is not None

    # Assert mutual independence
    assert state_a["thread_id"] == thread_a
    assert state_a["vehicle_id"] == "AMBULANCE-01"
    assert state_a["emergency_session_id"] == "sess_A"

    assert state_b["thread_id"] == thread_b
    assert state_b["vehicle_id"] == "FIRE-09"
    assert state_b["emergency_session_id"] == "sess_B"

    assert state_a["emergency_session_id"] != state_b["emergency_session_id"]


# ---------------------------------------------------------------------------
# 5. Distinguishable Workflow Statuses
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_completed_workflow_state_semantics(sample_request, tmp_path):
    """Test 5: Completed execution correctly distinguishes COMPLETED, PROPOSED, and no execution."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_completed_semantics"

    response = await agent.run(sample_request, thread_id=thread_id)

    assert response.proposal_status == ProposalStatus.PROPOSED
    assert response.workflow_status == WorkflowStatus.COMPLETED

    state = agent.get_state(thread_id)
    assert state["workflow_status"] == WorkflowStatus.COMPLETED.value
    assert state["proposal_status"] == ProposalStatus.PROPOSED
    assert state["is_valid"] is True
    assert state["signal_execution_performed"] is False
    assert state["current_stage"] == "validation"


@pytest.mark.asyncio
async def test_rejected_proposal_checkpoint_state(tmp_path):
    """Test 6: Rejected proposals are checkpointed with status REJECTED and is_valid=False."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)

    rejected_req = SignalActionAgentRequest(
        emergency_session_id="sess_reject_cp",
        vehicle_id="POLICE-03",
        vehicle_type="Police",
        route_id="route_empty",
        route_name="Empty Route",
        ordered_junctions=[],
    )
    thread_id = "thread_rejected_state"

    response = await agent.run(rejected_req, thread_id=thread_id)

    assert response.proposal_status == ProposalStatus.REJECTED
    assert response.workflow_status == WorkflowStatus.REJECTED

    state = agent.get_state(thread_id)
    assert state is not None
    assert state["workflow_status"] == WorkflowStatus.REJECTED.value
    assert state["proposal_status"] == ProposalStatus.REJECTED
    assert state["is_valid"] is False
    assert len(state["proposed_actions"]) == 0
    assert state["signal_execution_performed"] is False


@pytest.mark.asyncio
async def test_failed_workflow_state_handling(tmp_path):
    """Test 7: Missing request or unrecoverable error records status FAILED or REJECTED."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_failed_state"

    # Invoke workflow directly with state lacking request
    broken_state = {"thread_id": thread_id, "mock_mode": True}
    res = await agent.workflow.ainvoke(
        broken_state, config={"configurable": {"thread_id": thread_id}}
    )

    assert res["workflow_status"] in [WorkflowStatus.FAILED.value, WorkflowStatus.REJECTED.value]
    assert res["error"] is not None


# ---------------------------------------------------------------------------
# 6. Workflow Resume & Recovery
# ---------------------------------------------------------------------------

def test_workflow_resume_and_recovery(sample_request, tmp_path):
    """Test 8: Workflow can pause before a stage and be resumed from the saved checkpoint."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    thread_id = "thread_resume_demo"
    cfg = {"configurable": {"thread_id": thread_id}}

    # Phase 1: Compile graph with interrupt before 'validation'
    with SqliteSaver.from_conn_string(db_path) as cp1:
        paused_graph = compile_signal_action_workflow(
            checkpointer=cp1,
            interrupt_before=["validation"],
        )
        initial_state = {
            "request": sample_request,
            "mock_mode": True,
            "thread_id": thread_id,
        }
        paused_res = paused_graph.invoke(initial_state, config=cfg)

        # Confirm graph stopped before validation
        snapshot = paused_graph.get_state(cfg)
        assert snapshot.next == ("validation",), f"Expected next stage to be validation, got {snapshot.next}"
        assert snapshot.values.get("current_stage") == "structured_proposal"
        assert len(snapshot.values.get("proposed_actions", [])) == 3
        # Validation has not run yet
        assert "is_valid" not in snapshot.values

    # Phase 2: Resume from checkpoint in a new checkpointer session
    with SqliteSaver.from_conn_string(db_path) as cp2:
        resume_graph = compile_signal_action_workflow(checkpointer=cp2)
        # Passing None resumes execution from the saved checkpoint
        resumed_res = resume_graph.invoke(None, config=cfg)

        final_snapshot = resume_graph.get_state(cfg)
        assert final_snapshot.next == (), "Expected workflow to complete"
        assert final_snapshot.values.get("current_stage") == "validation"
        assert final_snapshot.values.get("workflow_status") == WorkflowStatus.COMPLETED.value
        assert final_snapshot.values.get("is_valid") is True
        assert final_snapshot.values.get("proposal_status") == ProposalStatus.PROPOSED


# ---------------------------------------------------------------------------
# 7. Security Boundary: No Secrets in Checkpoint Storage
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_secrets_in_checkpoint_database(sample_request, tmp_path):
    """Test 9: Checkpointed state and SQLite storage never contain secrets, keys, or credentials."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_security_audit"

    await agent.run(sample_request, thread_id=thread_id)

    # 1. Inspect deserialized state dictionary
    state = agent.get_state(thread_id)
    assert "GEMINI_API_KEY" not in state
    assert "api_key" not in state
    assert "password" not in state
    assert "secret" not in state
    assert "token" not in state

    # 2. Inspect raw SQLite database bytes for potential leaked secrets
    forbidden_terms = [
        "AIzaSy",  # Google API key prefix
        "GEMINI_API_KEY",
        "bearer",
        "secret_key",
        "private_key",
        "postgres://",
    ]

    with open(db_path, "rb") as f:
        raw_db_content = f.read().decode("latin1")
        for term in forbidden_terms:
            assert term not in raw_db_content, f"Security violation: found '{term}' in SQLite checkpoint file."


# ---------------------------------------------------------------------------
# 8. Preservation of Safety Boundary & Read-Only Tools
# ---------------------------------------------------------------------------

def test_read_only_tool_restrictions_preserved():
    """Test 10: Phase 3 read-only tool restrictions remain strictly enforced in Phase 4."""
    client = ReadOnlyCorridorToolClient()

    assert client.is_read_only is True

    with pytest.raises(PermissionError, match="execute_signal_change is forbidden"):
        client.execute_signal_change()

    with pytest.raises(PermissionError, match="activate_green_wave is forbidden"):
        client.activate_green_wave()

    with pytest.raises(PermissionError, match="complete_emergency is forbidden"):
        client.complete_emergency()


@pytest.mark.asyncio
async def test_validation_occurs_after_proposal_in_checkpoints(sample_request, tmp_path):
    """Test 11: Checkpoint history confirms validation deterministically runs after proposal generation."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_history_ordering"

    await agent.run(sample_request, thread_id=thread_id)

    # get_state_history returns newest first; reverse to examine chronological sequence
    history = agent.get_state_history(thread_id)
    stages = [h.get("current_stage") for h in reversed(history) if h.get("current_stage")]

    # Check that both stages occurred and validation was recorded after structured_proposal
    assert "structured_proposal" in stages
    assert "validation" in stages
    idx_proposal = stages.index("structured_proposal")
    idx_validation = stages.index("validation")
    assert idx_validation > idx_proposal, "Validation must execute after structured proposal"



@pytest.mark.asyncio
async def test_no_signal_execution_occurs(sample_request, tmp_path):
    """Test 12: Signal changes are never executed; status is strictly PROPOSED."""
    db_path = str(tmp_path / "checkpoints.sqlite")
    agent = SignalActionAgent(default_mock_mode=True, checkpoint_db_path=db_path)
    thread_id = "thread_no_exec"

    response = await agent.run(sample_request, thread_id=thread_id)

    assert response.proposal_status == ProposalStatus.PROPOSED
    assert response.proposal_status != "EXECUTED"
    assert response.proposal_status != "ACTIVE"

    state = agent.get_state(thread_id)
    assert state.get("signal_execution_performed") is False


# ---------------------------------------------------------------------------
# 9. FastAPI State Retrieval Endpoints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fastapi_checkpoint_endpoints(sample_request):
    """Test 13: FastAPI HTTP endpoints support proposal generation and checkpoint state retrieval."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        thread_id = "fastapi_test_thread_99"

        # 1. Propose signals with thread_id
        prop_resp = await client.post(
            f"/api/v1/agent/propose-signals?mock_mode=true&thread_id={thread_id}",
            json=sample_request.model_dump(),
        )
        assert prop_resp.status_code == 200
        prop_data = prop_resp.json()
        assert prop_data["proposal_status"] == "PROPOSED"
        assert prop_data["thread_id"] == thread_id

        # 2. Retrieve checkpoint state by thread_id
        state_resp = await client.get(f"/api/v1/agent/state/{thread_id}")
        assert state_resp.status_code == 200
        state_data = state_resp.json()
        assert state_data["thread_id"] == thread_id
        assert state_data["workflow_status"] == "COMPLETED"
        assert state_data["emergency_session_id"] == sample_request.emergency_session_id
        assert state_data["signal_execution_performed"] is False
        assert len(state_data["proposed_actions"]) == 3

        # 3. Retrieve checkpoint history
        hist_resp = await client.get(f"/api/v1/agent/history/{thread_id}")
        assert hist_resp.status_code == 200
        hist_data = hist_resp.json()
        assert len(hist_data) > 0

        # 4. Unknown thread_id returns 404
        not_found_resp = await client.get("/api/v1/agent/state/non_existent_thread_xyz_99")
        assert not_found_resp.status_code == 404
