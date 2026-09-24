"""Signal Action Agent for Emergency Green Wave corridor clearance.

Analyzes an emergency vehicle and its assigned route with ordered junctions,
then produces a validated, non-destructive signal action proposal.
"""

from typing import Optional
from app.graph.state import AgentState
from app.graph.workflow import (
    CompiledSignalActionWorkflow,
    signal_action_workflow,
)
from app.models.schemas import (
    SignalActionAgentRequest,
    SignalActionProposalResponse,
)


class SignalActionAgent:
    """Agent orchestrating the route analysis, reasoning, proposal, and validation."""

    def __init__(
        self,
        workflow: Optional[CompiledSignalActionWorkflow] = None,
        default_mock_mode: bool = False,
    ):
        self.workflow = workflow or signal_action_workflow
        self.default_mock_mode = default_mock_mode

    async def run(
        self,
        request: SignalActionAgentRequest,
        mock_mode: Optional[bool] = None,
    ) -> SignalActionProposalResponse:
        """Execute the Signal Action Agent graph on an emergency route request.

        Args:
            request: The emergency vehicle and route junction input payload.
            mock_mode: If True, uses deterministic reasoning without making external API calls.
                       Defaults to self.default_mock_mode.

        Returns:
            SignalActionProposalResponse: Validated proposal marked as PROPOSED (or REJECTED).
        """
        effective_mock = self.default_mock_mode if mock_mode is None else mock_mode

        initial_state: AgentState = {
            "request": request,
            "mock_mode": effective_mock,
        }

        final_state = await self.workflow.ainvoke(initial_state)

        return final_state["final_response"]
