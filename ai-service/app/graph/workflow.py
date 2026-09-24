"""Workflow graph definition for the Signal Action Agent.

Implements the 5-stage LangGraph workflow:
  [START]
     │
     ▼
[input_context]       (Stage 1: Normalize input route & junction telemetry)
     │
     ▼
[tool_retrieval]      (Stage 2: Controlled read-only corridor tool queries)
     │
     ▼
[reasoning]           (Stage 3: Gemini LLM / deterministic corridor reasoning)
     │
     ▼
[structured_proposal] (Stage 4: Transform reasoning into typed JunctionAction objects)
     │
     ▼
[validation]          (Stage 5: Deterministic safety & route invariant verification)
     │
     ▼
   [END]
"""

from typing import Any, Callable, Dict, List
from app.graph.nodes import (
    input_context_node,
    tool_retrieval_node,
    reasoning_node,
    structured_proposal_node,
    validation_node,
)
from app.graph.state import AgentState

# Stage node constants
STAGE_INPUT_CONTEXT = "input_context"
STAGE_TOOL_RETRIEVAL = "tool_retrieval"
STAGE_REASONING = "reasoning"
STAGE_STRUCTURED_PROPOSAL = "structured_proposal"
STAGE_VALIDATION = "validation"

START = "__start__"
END = "__end__"


class CompiledSignalActionWorkflow:
    """Compiled runnable workflow executing the Signal Action Agent graph."""

    def __init__(self, nodes: Dict[str, Callable], sequence: List[str]):
        self.nodes = nodes
        self.sequence = sequence

    async def ainvoke(self, initial_state: AgentState) -> AgentState:
        """Execute the workflow asynchronously through all defined stages."""
        state = dict(initial_state)
        for stage in self.sequence:
            node_fn = self.nodes[stage]
            output = await node_fn(state)
            state.update(output)
        return state


def build_signal_action_workflow() -> CompiledSignalActionWorkflow:
    """Build and compile the Signal Action Agent state graph."""
    nodes = {
        STAGE_INPUT_CONTEXT: input_context_node,
        STAGE_TOOL_RETRIEVAL: tool_retrieval_node,
        STAGE_REASONING: reasoning_node,
        STAGE_STRUCTURED_PROPOSAL: structured_proposal_node,
        STAGE_VALIDATION: validation_node,
    }

    # Explicit stage ordering
    sequence = [
        STAGE_INPUT_CONTEXT,
        STAGE_TOOL_RETRIEVAL,
        STAGE_REASONING,
        STAGE_STRUCTURED_PROPOSAL,
        STAGE_VALIDATION,
    ]

    return CompiledSignalActionWorkflow(nodes=nodes, sequence=sequence)


# Default compiled workflow instance
signal_action_workflow = build_signal_action_workflow()
