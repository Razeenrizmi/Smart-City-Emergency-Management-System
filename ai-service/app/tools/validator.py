"""Deterministic safety validator for Signal Action Agent proposals.

Enforces critical safety invariants:
1. Proposed junctions must strictly belong to the supplied route.
2. Junction sequence order must follow the route traversal order.
3. Only allowed signal action types are accepted.
4. Empty junction lists or empty proposal sets are rejected.
5. The proposal is strictly marked as PROPOSED (never executed).
"""

from typing import List, NamedTuple, Set
from app.models.schemas import (
    ApprovalStatus,
    JunctionAction,
    JunctionInput,
    ProposalStatus,
    SignalActionType,
)

# Set of string values representing valid action types
ALLOWED_ACTION_VALUES: Set[str] = {action.value for action in SignalActionType}


class ValidationReport(NamedTuple):
    """Result of deterministic proposal validation."""

    is_valid: bool
    status: ProposalStatus
    notes: List[str]
    validated_actions: List[JunctionAction]
    approval_status: ApprovalStatus = ApprovalStatus.PENDING_APPROVAL


def validate_signal_action_proposal(
    input_junctions: List[JunctionInput],
    proposed_actions: List[JunctionAction],
    vehicle_type: str,
) -> ValidationReport:
    """Validate that the agent proposal satisfies all route and safety constraints."""
    notes: List[str] = []

    # 1. Reject empty input route junctions
    if not input_junctions:
        notes.append("REJECTION: Supplied route contains no junctions to clear.")
        return ValidationReport(
            is_valid=False,
            status=ProposalStatus.REJECTED,
            notes=notes,
            validated_actions=[],
            approval_status=ApprovalStatus.REJECTED,
        )

    # 2. Reject empty proposed action list
    if not proposed_actions:
        notes.append("REJECTION: Proposal does not contain any junction clearing actions.")
        return ValidationReport(
            is_valid=False,
            status=ProposalStatus.REJECTED,
            notes=notes,
            validated_actions=[],
            approval_status=ApprovalStatus.REJECTED,
        )

    # 3. Verify all proposed junctions belong to the supplied route
    valid_route_junctions = {j.junction_id: j for j in input_junctions}
    for action in proposed_actions:
        if action.junction_id not in valid_route_junctions:
            notes.append(
                f"REJECTION: Proposed junction '{action.junction_id}' ({action.junction_name}) "
                f"does not belong to the selected route."
            )
            return ValidationReport(
                is_valid=False,
                status=ProposalStatus.REJECTED,
                notes=notes,
                validated_actions=[],
                approval_status=ApprovalStatus.REJECTED,
            )

    # 4. Verify junction sequence order follows the route traversal order
    sorted_input_ids = [
        j.junction_id for j in sorted(input_junctions, key=lambda x: x.sequence_order)
    ]
    proposed_ids = [action.junction_id for action in proposed_actions]

    if proposed_ids != sorted_input_ids:
        notes.append(
            f"REJECTION: Proposed junction sequence {proposed_ids} does not match "
            f"route sequence order {sorted_input_ids}."
        )
        return ValidationReport(
            is_valid=False,
            status=ProposalStatus.REJECTED,
            notes=notes,
            validated_actions=[],
            approval_status=ApprovalStatus.REJECTED,
        )

    # Verify sequence_order numbers are strictly non-decreasing and sequential
    for i, action in enumerate(proposed_actions):
        expected_seq = input_junctions[i].sequence_order
        if action.sequence_order != expected_seq:
            notes.append(
                f"REJECTION: Action for junction '{action.junction_id}' has sequence_order "
                f"{action.sequence_order}, expected {expected_seq}."
            )
            return ValidationReport(
                is_valid=False,
                status=ProposalStatus.REJECTED,
                notes=notes,
                validated_actions=[],
                approval_status=ApprovalStatus.REJECTED,
            )

    # 5. Verify allowed signal action types
    for action in proposed_actions:
        action_val = action.action.value if isinstance(action.action, SignalActionType) else str(action.action)
        if action_val not in ALLOWED_ACTION_VALUES:
            notes.append(
                f"REJECTION: Disallowed signal action '{action_val}' for junction '{action.junction_id}'. "
                f"Allowed actions: {list(ALLOWED_ACTION_VALUES)}."
            )
            return ValidationReport(
                is_valid=False,
                status=ProposalStatus.REJECTED,
                notes=notes,
                validated_actions=[],
                approval_status=ApprovalStatus.REJECTED,
            )

    # 6. Safety check: Verify hold duration bounds (5 to 300 seconds)
    for action in proposed_actions:
        if action.hold_duration_seconds < 5 or action.hold_duration_seconds > 300:
            notes.append(
                f"REJECTION: Hold duration {action.hold_duration_seconds}s for junction '{action.junction_id}' "
                f"is out of safe simulation bounds (5-300s)."
            )
            return ValidationReport(
                is_valid=False,
                status=ProposalStatus.REJECTED,
                notes=notes,
                validated_actions=[],
                approval_status=ApprovalStatus.REJECTED,
            )

    # All checks passed
    notes.append(
        f"VALIDATION PASSED: Verified {len(proposed_actions)} junction actions along route. "
        f"All junctions belong to route, order strictly preserved, actions within allowed set. "
        f"Marked as PROPOSED (not executed)."
    )
    return ValidationReport(
        is_valid=True,
        status=ProposalStatus.PROPOSED,
        notes=notes,
        validated_actions=proposed_actions,
        approval_status=ApprovalStatus.PENDING_APPROVAL,
    )
