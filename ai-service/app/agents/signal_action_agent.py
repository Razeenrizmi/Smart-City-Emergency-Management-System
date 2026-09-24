"""Signal Action Agent for Emergency Green Wave corridor clearance.

Analyzes an emergency vehicle and its assigned route with ordered junctions,
then produces a validated, non-destructive signal action proposal.
State is persistently checkpointed to SQLite across all workflow stages.
"""

from typing import Any, Dict, List, Optional
from app.config import settings
from app.graph.state import AgentState
from app.graph.workflow import (
    CompiledSignalActionWorkflow,
    build_signal_action_workflow,
    signal_action_workflow,
)
from app.models.schemas import (
    SignalActionAgentRequest,
    SignalActionProposalResponse,
    WorkflowStatus,
)


class SignalActionAgent:
    """Agent orchestrating route analysis, reasoning, proposal, validation, and SQLite checkpointing."""

    def __init__(
        self,
        workflow: Optional[CompiledSignalActionWorkflow] = None,
        default_mock_mode: bool = False,
        checkpoint_db_path: Optional[str] = None,
    ):
        self.checkpoint_db_path = checkpoint_db_path or settings.CHECKPOINT_DB_PATH
        if workflow is not None:
            self.workflow = workflow
        elif checkpoint_db_path is not None:
            self.workflow = build_signal_action_workflow(checkpoint_db_path=checkpoint_db_path)
        else:
            self.workflow = signal_action_workflow
        self.default_mock_mode = default_mock_mode

    async def run(
        self,
        request: SignalActionAgentRequest,
        mock_mode: Optional[bool] = None,
        thread_id: Optional[str] = None,
    ) -> SignalActionProposalResponse:
        """Execute the Signal Action Agent graph on an emergency route request.

        Args:
            request: The emergency vehicle and route junction input payload.
            mock_mode: If True, uses deterministic reasoning without making external API calls.
                       Defaults to self.default_mock_mode.
            thread_id: Optional stable execution thread identifier. Defaults to request.thread_id
                       or derives from emergency_session_id.

        Returns:
            SignalActionProposalResponse: Validated proposal marked as PROPOSED (or REJECTED),
            annotated with the stable thread_id and workflow_status.
        """
        effective_mock = self.default_mock_mode if mock_mode is None else mock_mode
        stable_thread_id = (
            thread_id
            or request.thread_id
            or f"thread_{request.emergency_session_id}"
        )

        initial_state: AgentState = {
            "request": request,
            "mock_mode": effective_mock,
            "thread_id": stable_thread_id,
            "emergency_session_id": request.emergency_session_id,
            "route_id": request.route_id,
            "route_name": request.route_name,
            "vehicle_id": request.vehicle_id,
            "vehicle_type": request.vehicle_type,
            "workflow_status": WorkflowStatus.RUNNING.value,
            "current_stage": "START",
            "signal_execution_performed": False,
        }

        config = {"configurable": {"thread_id": stable_thread_id}}
        final_state = await self.workflow.ainvoke(initial_state, config=config)

        final_response: SignalActionProposalResponse = final_state["final_response"]
        # Ensure thread_id and workflow status are populated on the response
        if not final_response.thread_id:
            final_response.thread_id = stable_thread_id
        if not final_response.workflow_status and "workflow_status" in final_state:
            try:
                final_response.workflow_status = WorkflowStatus(final_state["workflow_status"])
            except Exception:
                pass

        return final_response

    def get_state(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the latest checkpointed state for a given thread_id."""
        config = {"configurable": {"thread_id": thread_id}}
        snapshot = self.workflow.get_state(config)
        if not snapshot or not snapshot.values:
            return None
        return snapshot.values

    def get_state_history(self, thread_id: str) -> List[Dict[str, Any]]:
        """Retrieve the sequence of historical checkpoint states for a thread_id."""
        config = {"configurable": {"thread_id": thread_id}}
        history = self.workflow.get_state_history(config)
        return [h.values for h in history if h and h.values]
