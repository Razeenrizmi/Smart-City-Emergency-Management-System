"""Workflow graph definition for the Signal Action Agent with persistent SQLite checkpointing.

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

Checkpoints every stage to SQLite using official `SqliteSaver` from `langgraph-checkpoint-sqlite`.
"""

import asyncio
import os
import uuid
from typing import Any, Dict, List, Optional

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph

from app.config import settings
from app.graph.nodes import (
    input_context_node,
    reasoning_node,
    structured_proposal_node,
    tool_retrieval_node,
    validation_node,
)
from app.graph.state import AgentState

# Stage node constants
STAGE_INPUT_CONTEXT = "input_context"
STAGE_TOOL_RETRIEVAL = "tool_retrieval"
STAGE_REASONING = "reasoning"
STAGE_STRUCTURED_PROPOSAL = "structured_proposal"
STAGE_VALIDATION = "validation"


def build_signal_action_graph() -> StateGraph:
    """Build the uncompiled 5-stage Signal Action Agent StateGraph."""
    workflow = StateGraph(AgentState)

    # 1. Register stage nodes
    workflow.add_node(STAGE_INPUT_CONTEXT, input_context_node)
    workflow.add_node(STAGE_TOOL_RETRIEVAL, tool_retrieval_node)
    workflow.add_node(STAGE_REASONING, reasoning_node)
    workflow.add_node(STAGE_STRUCTURED_PROPOSAL, structured_proposal_node)
    workflow.add_node(STAGE_VALIDATION, validation_node)

    # 2. Define sequential edges
    workflow.add_edge(START, STAGE_INPUT_CONTEXT)
    workflow.add_edge(STAGE_INPUT_CONTEXT, STAGE_TOOL_RETRIEVAL)
    workflow.add_edge(STAGE_TOOL_RETRIEVAL, STAGE_REASONING)
    workflow.add_edge(STAGE_REASONING, STAGE_STRUCTURED_PROPOSAL)
    workflow.add_edge(STAGE_STRUCTURED_PROPOSAL, STAGE_VALIDATION)
    workflow.add_edge(STAGE_VALIDATION, END)

    return workflow


def compile_signal_action_workflow(
    checkpointer: Optional[BaseCheckpointSaver] = None,
    interrupt_before: Optional[List[str]] = None,
    interrupt_after: Optional[List[str]] = None,
):
    """Compile the Signal Action Agent StateGraph with an actual BaseCheckpointSaver instance.

    CRITICAL RULE:
    Pass an actual BaseCheckpointSaver instance (such as SqliteSaver yielded from
    `with SqliteSaver.from_conn_string(...) as saver:`).
    Do NOT pass an async context manager or generator directly.
    """
    graph_builder = build_signal_action_graph()
    if checkpointer is not None and hasattr(checkpointer, "serde") and hasattr(checkpointer.serde, "with_msgpack_allowlist"):
        checkpointer.serde = checkpointer.serde.with_msgpack_allowlist([("app.models.schemas",)])

    return graph_builder.compile(
        checkpointer=checkpointer,
        interrupt_before=interrupt_before,
        interrupt_after=interrupt_after,
    )


class CompiledSignalActionWorkflow:
    """High-level runner wrapping the Signal Action Agent graph with SQLite checkpointing."""

    def __init__(
        self,
        checkpoint_db_path: Optional[str] = None,
        graph_builder: Optional[StateGraph] = None,
    ):
        self.checkpoint_db_path = checkpoint_db_path or settings.CHECKPOINT_DB_PATH
        self.graph_builder = graph_builder or build_signal_action_graph()
        self.db_dir = os.path.dirname(os.path.abspath(self.checkpoint_db_path))
        os.makedirs(self.db_dir, exist_ok=True)

    def _prepare_config(
        self,
        state: Optional[AgentState] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Ensure config has a stable thread_id derived from state or explicitly passed."""
        cfg = dict(config or {})
        configurable = dict(cfg.get("configurable", {}))

        if "thread_id" not in configurable:
            thread_id = None
            if state and isinstance(state, dict):
                thread_id = state.get("thread_id")
                if not thread_id and "request" in state:
                    req = state["request"]
                    if hasattr(req, "emergency_session_id") and req.emergency_session_id:
                        thread_id = f"thread_{req.emergency_session_id}"
            configurable["thread_id"] = thread_id or f"thread_{uuid.uuid4().hex[:12]}"

        cfg["configurable"] = configurable
        return cfg

    def invoke(
        self,
        initial_state: Optional[AgentState] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> AgentState:
        """Execute the workflow synchronously using the SQLite checkpoint backend."""
        cfg = self._prepare_config(state=initial_state, config=config)
        os.makedirs(self.db_dir, exist_ok=True)

        with SqliteSaver.from_conn_string(self.checkpoint_db_path) as checkpointer:
            if hasattr(checkpointer, "serde") and hasattr(checkpointer.serde, "with_msgpack_allowlist"):
                checkpointer.serde = checkpointer.serde.with_msgpack_allowlist([("app.models.schemas",)])
            graph = self.graph_builder.compile(checkpointer=checkpointer)
            return graph.invoke(initial_state, config=cfg)

    async def ainvoke(
        self,
        initial_state: Optional[AgentState] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> AgentState:
        """Execute the workflow asynchronously through a dedicated worker thread."""
        return await asyncio.to_thread(self.invoke, initial_state, config=config)

    def get_state(self, config: Dict[str, Any]):
        """Retrieve the latest checkpointed state snapshot for a thread."""
        os.makedirs(self.db_dir, exist_ok=True)
        with SqliteSaver.from_conn_string(self.checkpoint_db_path) as checkpointer:
            if hasattr(checkpointer, "serde") and hasattr(checkpointer.serde, "with_msgpack_allowlist"):
                checkpointer.serde = checkpointer.serde.with_msgpack_allowlist([("app.models.schemas",)])
            graph = self.graph_builder.compile(checkpointer=checkpointer)
            return graph.get_state(config)

    def get_state_history(self, config: Dict[str, Any]):
        """Retrieve all checkpoint state snapshots in historical sequence."""
        os.makedirs(self.db_dir, exist_ok=True)
        with SqliteSaver.from_conn_string(self.checkpoint_db_path) as checkpointer:
            if hasattr(checkpointer, "serde") and hasattr(checkpointer.serde, "with_msgpack_allowlist"):
                checkpointer.serde = checkpointer.serde.with_msgpack_allowlist([("app.models.schemas",)])
            graph = self.graph_builder.compile(checkpointer=checkpointer)
            return list(graph.get_state_history(config))

    def update_state(
        self,
        config: Dict[str, Any],
        values: Dict[str, Any],
        as_node: Optional[str] = None,
    ):
        """Update checkpointed state for a thread with new values."""
        os.makedirs(self.db_dir, exist_ok=True)
        with SqliteSaver.from_conn_string(self.checkpoint_db_path) as checkpointer:
            if hasattr(checkpointer, "serde") and hasattr(checkpointer.serde, "with_msgpack_allowlist"):
                checkpointer.serde = checkpointer.serde.with_msgpack_allowlist([("app.models.schemas",)])
            graph = self.graph_builder.compile(checkpointer=checkpointer)
            return graph.update_state(config, values, as_node=as_node)

    async def aupdate_state(
        self,
        config: Dict[str, Any],
        values: Dict[str, Any],
        as_node: Optional[str] = None,
    ):
        """Update checkpointed state asynchronously."""
        return await asyncio.to_thread(self.update_state, config, values, as_node=as_node)


def build_signal_action_workflow(
    checkpoint_db_path: Optional[str] = None,
) -> CompiledSignalActionWorkflow:
    """Build and compile the default Signal Action Agent workflow runner."""
    return CompiledSignalActionWorkflow(checkpoint_db_path=checkpoint_db_path)


# Default compiled workflow instance
signal_action_workflow = build_signal_action_workflow()
