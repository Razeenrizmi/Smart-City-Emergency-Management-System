"""Deterministic prompt-injection and untrusted input protection layer.

Treats all route names, junction names, vehicle telemetry, and external data
as UNTRUSTED DATA. Enforces deterministic input inspection before the agent
can process or pass data to reasoning engines.

Detects unauthorized instruction-injection patterns:
- "ignore previous instructions" / "ignore all previous instructions"
- "system prompt"
- "developer message"
- "execute signal change"
- "activate green wave"
- "bypass validation"
"""

import re
from typing import Any, Dict, List, Optional
from app.models.schemas import SignalActionAgentRequest

# Deterministic instruction-override and unauthorized command patterns
PROHIBITED_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+instructions?",
    r"system\s+prompt",
    r"developer\s+message",
    r"execute\s+signal\s+change",
    r"activate\s+green\s+wave",
    r"bypass\s+validation",
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in PROHIBITED_INJECTION_PATTERNS]


def detect_prompt_injection(text: Optional[str]) -> Optional[str]:
    """Scan text for prohibited prompt injection or unauthorized instruction overrides.

    Returns the matched phrase description if an injection pattern is detected,
    or None if the text is clean.
    """
    if not text or not isinstance(text, str):
        return None

    normalized_text = " ".join(text.split())
    for pattern in COMPILED_PATTERNS:
        match = pattern.search(normalized_text)
        if match:
            return f"Prohibited instruction pattern '{match.group(0)}' detected"

    return None


def inspect_untrusted_request_inputs(request: SignalActionAgentRequest) -> List[str]:
    """Inspect all untrusted input fields in a SignalActionAgentRequest.

    Scans route name, vehicle identifiers, and all junction telemetry for
    instruction-injection attempts.
    """
    violations: List[str] = []

    # Check top-level untrusted fields
    fields_to_check = [
        ("route_name", request.route_name),
        ("route_id", request.route_id),
        ("vehicle_id", request.vehicle_id),
        ("vehicle_type", request.vehicle_type),
        ("emergency_session_id", request.emergency_session_id),
    ]

    for field_name, value in fields_to_check:
        detection = detect_prompt_injection(value)
        if detection:
            violations.append(f"Field '{field_name}': {detection}")

    # Check junction telemetry
    for j in request.ordered_junctions:
        junc_detection = detect_prompt_injection(j.junction_name)
        if junc_detection:
            violations.append(
                f"Junction '{j.junction_id}' name: {junc_detection}"
            )
        junc_id_detection = detect_prompt_injection(j.junction_id)
        if junc_id_detection:
            violations.append(
                f"Junction ID '{j.junction_id}': {junc_id_detection}"
            )
        if j.current_signal_state:
            state_detection = detect_prompt_injection(j.current_signal_state)
            if state_detection:
                violations.append(
                    f"Junction '{j.junction_id}' signal state: {state_detection}"
                )

    return violations


def inspect_untrusted_retrieved_data(data: Dict[str, Any]) -> List[str]:
    """Inspect data retrieved from external read-only tools for instruction injection."""
    violations: List[str] = []

    def _scan_obj(prefix: str, obj: Any):
        if isinstance(obj, str):
            detection = detect_prompt_injection(obj)
            if detection:
                violations.append(f"Retrieved '{prefix}': {detection}")
        elif isinstance(obj, dict):
            for k, v in obj.items():
                _scan_obj(f"{prefix}.{k}" if prefix else k, v)
        elif isinstance(obj, list):
            for idx, item in enumerate(obj):
                _scan_obj(f"{prefix}[{idx}]", item)

    _scan_obj("", data)
    return violations
