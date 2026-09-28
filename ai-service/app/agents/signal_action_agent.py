"""Signal Action Agent for Emergency Green Wave corridor clearance.

Analyzes an emergency vehicle and its assigned route with ordered junctions,
then produces a validated, non-destructive signal action proposal.
State is persistently checkpointed to SQLite across all workflow stages.
"""

import asyncio
from app.security.prompt_protection import inspect_untrusted_request_inputs
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.config import settings
from app.graph.state import AgentState
from app.graph.workflow import (
    CompiledSignalActionWorkflow,
    build_signal_action_workflow,
    signal_action_workflow,
)
from app.models.schemas import (
    ApprovalActionResponse,
    ApprovalStatus,
    GreenWaveHandoffPayload,
    JunctionAction,
    ProposalStatus,
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
                  
        security_violations = inspect_untrusted_request_inputs(request)

        if security_violations:
            raise ValueError(
                "Request rejected by prompt-injection protection: "
                + "; ".join(security_violations)
            )

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

    def approve(
        self,
        thread_id: str,
        operator_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ApprovalActionResponse:
        """Approve a validated Signal Action proposal by thread ID.

        Enforces safety invariants:
        - Checkpoint state must exist for thread_id
        - Deterministic validation must have passed (is_valid is True)
        - Proposal must NOT already be rejected
        - AI Agent NEVER executes signal changes (signal_execution_performed remains False)
        - Exposes a safe handoff payload for ASP.NET execution layer
        """
        state = self.get_state(thread_id)
        if not state:
            raise ValueError(f"No checkpoint state found for thread_id '{thread_id}'.")

        # Invariant 1: Proposal must exist and validation must have passed
        if not state.get("is_valid"):
            raise ValueError(
                "Cannot approve proposal: proposal has not passed deterministic validation or is invalid."
            )

        # Invariant 2: Rejected proposal cannot be approved
        current_approval = str(state.get("approval_status", "")).upper()
        current_proposal_status = str(state.get("proposal_status", "")).upper()
        if (
            current_approval == ApprovalStatus.REJECTED.value
            or current_proposal_status == ProposalStatus.REJECTED.value
        ):
            raise ValueError("Cannot approve proposal: proposal was already rejected.")

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        approver = operator_id or "traffic_operator"
        audit_notes = notes or "Proposal approved by human traffic operator."

        # Update final_response if stored in state
        updated_final_response = None
        existing_resp = state.get("final_response")
        if existing_resp is not None and hasattr(existing_resp, "model_copy"):
            updated_final_response = existing_resp.model_copy(
                update={
                    "proposal_status": ProposalStatus.APPROVED,
                    "approval_status": ApprovalStatus.APPROVED,
                    "handoff_ready": True,
                    "approved_at": now,
                    "approved_by": approver,
                    "approval_notes": audit_notes,
                }
            )

        # Invariant 3: signal_execution_performed is strictly False
        state_updates: Dict[str, Any] = {
            "approval_status": ApprovalStatus.APPROVED.value,
            "proposal_status": ProposalStatus.APPROVED.value,
            "handoff_ready": True,
            "approved_at": now_iso,
            "approved_by": approver,
            "approval_notes": audit_notes,
            "signal_execution_performed": False,
            "updated_at": now_iso,
        }
        if updated_final_response is not None:
            state_updates["final_response"] = updated_final_response

        # Persist through SQLite checkpointer
        config = {"configurable": {"thread_id": thread_id}}
        self.workflow.update_state(config, state_updates)

        # Extract actions for safe handoff payload
        raw_actions = state.get("proposed_actions", [])
        typed_actions: List[JunctionAction] = []
        for a in raw_actions:
            if isinstance(a, JunctionAction):
                typed_actions.append(a)
            elif isinstance(a, dict):
                try:
                    typed_actions.append(JunctionAction(**a))
                except Exception:
                    pass

        handoff_payload = GreenWaveHandoffPayload(
            emergency_session_id=str(state.get("emergency_session_id") or ""),
            route_id=str(state.get("route_id") or ""),
            route_name=str(state.get("route_name") or ""),
            vehicle_id=str(state.get("vehicle_id") or ""),
            vehicle_type=str(state.get("vehicle_type") or ""),
            thread_id=thread_id,
            approval_status=ApprovalStatus.APPROVED,
            handoff_ready=True,
            approved_at=now,
            approved_by=approver,
            junction_actions=typed_actions,
            reasoning_summary=str(
                state.get("overall_reason")
                or state.get("raw_reasoning")
                or "Emergency corridor clearance approved."
            ),
            signal_execution_performed=False,
        )

        return ApprovalActionResponse(
            thread_id=thread_id,
            approval_status=ApprovalStatus.APPROVED,
            proposal_status=ProposalStatus.APPROVED,
            is_valid=True,
            handoff_ready=True,
            signal_execution_performed=False,
            approved_at=now,
            approved_by=approver,
            approval_notes=audit_notes,
            proposal=updated_final_response,
            handoff_payload=handoff_payload,
            message="Proposal successfully approved. Ready for safe handoff to ASP.NET Green Wave execution.",
        )

    def reject(
        self,
        thread_id: str,
        operator_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ApprovalActionResponse:
        """Reject a Signal Action proposal by thread ID.

        Enforces safety invariants:
        - Checkpoint state must exist for thread_id
        - Marks proposal and approval as REJECTED in SQLite checkpoint
        - handoff_ready is False and no handoff payload is generated
        - AI Agent NEVER executes signal changes
        """
        state = self.get_state(thread_id)
        if not state:
            raise ValueError(f"No checkpoint state found for thread_id '{thread_id}'.")

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        operator = operator_id or "traffic_operator"
        audit_notes = notes or "Proposal rejected by traffic operator."

        updated_final_response = None
        existing_resp = state.get("final_response")
        if existing_resp is not None and hasattr(existing_resp, "model_copy"):
            updated_final_response = existing_resp.model_copy(
                update={
                    "proposal_status": ProposalStatus.REJECTED,
                    "approval_status": ApprovalStatus.REJECTED,
                    "handoff_ready": False,
                    "approved_at": None,
                    "approved_by": operator,
                    "approval_notes": audit_notes,
                }
            )

        state_updates: Dict[str, Any] = {
            "approval_status": ApprovalStatus.REJECTED.value,
            "proposal_status": ProposalStatus.REJECTED.value,
            "handoff_ready": False,
            "approved_at": None,
            "approved_by": operator,
            "approval_notes": audit_notes,
            "signal_execution_performed": False,
            "updated_at": now_iso,
        }
        if updated_final_response is not None:
            state_updates["final_response"] = updated_final_response

        # Persist through SQLite checkpointer
        config = {"configurable": {"thread_id": thread_id}}
        self.workflow.update_state(config, state_updates)

        return ApprovalActionResponse(
            thread_id=thread_id,
            approval_status=ApprovalStatus.REJECTED,
            proposal_status=ProposalStatus.REJECTED,
            is_valid=bool(state.get("is_valid", False)),
            handoff_ready=False,
            signal_execution_performed=False,
            approved_at=None,
            approved_by=operator,
            approval_notes=audit_notes,
            proposal=updated_final_response,
            handoff_payload=None,
            message="Proposal rejected. Cannot be handed off for execution.",
        )

    async def aapprove(
        self,
        thread_id: str,
        operator_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ApprovalActionResponse:
        """Approve a proposal asynchronously."""
        return await asyncio.to_thread(self.approve, thread_id, operator_id, notes)

    async def areject(
        self,
        thread_id: str,
        operator_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ApprovalActionResponse:
        """Reject a proposal asynchronously."""
        return await asyncio.to_thread(self.reject, thread_id, operator_id, notes)
