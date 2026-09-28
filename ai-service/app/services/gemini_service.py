"""Google Gemini integration service for the Signal Action Agent.

Provides structured reasoning for emergency corridor signal clearing.
Supports both live Google Gemini REST API calls and deterministic mock mode
for reliable offline testing without API keys.
"""

import json
import logging
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings
from app.models.schemas import (
    JunctionAction,
    JunctionInput,
    SignalActionAgentRequest,
    SignalActionType,
)

logger = logging.getLogger(__name__)

GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Default synthetic hold duration used ONLY for test/demo fallback execution.
# NOTE: This value is a placeholder test/demo fallback and is NOT an authoritative
# domain traffic-control rule for the Emergency Green Wave project.
DEFAULT_TEST_FALLBACK_HOLD_SECONDS: int = 30


class GeminiService:
    """Service handling Gemini LLM interaction for signal action proposals."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        self.timeout = timeout

    async def generate_signal_actions(
        self,
        request: SignalActionAgentRequest,
        mock_mode: bool = False,
    ) -> Dict[str, Any]:
        """Generate structured reasoning and junction actions for the route.

        If mock_mode is True or no API key is configured, uses synthetic test/demo fallback.
        Otherwise, invokes the Gemini API.
        """
        if mock_mode or not self.api_key:
            return self._generate_deterministic_proposal(request)

        try:
            return await self._call_gemini_api(request)
        except Exception as e:
            logger.warning(
                "Gemini API invocation encountered an error (%s); falling back to synthetic test/demo reasoning.",
                e,
            )
            fallback = self._generate_deterministic_proposal(request)
            fallback["reasoning"] += f" (Note: Generated via synthetic test/demo fallback due to LLM error: {e})"
            return fallback

    def _generate_deterministic_proposal(
        self, request: SignalActionAgentRequest
    ) -> Dict[str, Any]:
        """Generate a synthetic proposal for offline testing and demo fallback.

        NOTE: This is test/demo fallback behavior to allow offline automated verification
        without an active LLM connection. It does NOT represent project traffic-control rules
        or domain timing policies.
        """
        actions: List[Dict[str, Any]] = []
        num_junctions = len(request.ordered_junctions)
        test_hold_sec = DEFAULT_TEST_FALLBACK_HOLD_SECONDS

        for i, junction in enumerate(request.ordered_junctions):
            current_state = (junction.current_signal_state or "RED").upper()

            if i == 0:
                # Immediate approach junction
                if current_state == "GREEN":
                    action_type = SignalActionType.GREEN_CORRIDOR.value
                    reason = (
                        f"[Test/Demo Fallback] Immediate junction {junction.junction_name} is already GREEN. "
                        f"Proposing hold window of {test_hold_sec}s for simulation verification."
                    )
                else:
                    action_type = SignalActionType.PRIORITY_TRANSITION.value
                    reason = (
                        f"[Test/Demo Fallback] Immediate junction {junction.junction_name} is currently {current_state}. "
                        f"Proposing priority transition to GREEN with test hold window of {test_hold_sec}s."
                    )
            elif i == num_junctions - 1:
                # Final junction entering destination
                action_type = SignalActionType.GREEN_CORRIDOR.value
                reason = (
                    f"[Test/Demo Fallback] Terminal corridor junction {junction.junction_name}. "
                    f"Proposing hold GREEN for {test_hold_sec}s for simulation verification."
                )
            else:
                # Intermediate corridor junction
                action_type = SignalActionType.GREEN_CORRIDOR.value
                reason = (
                    f"[Test/Demo Fallback] Intermediate corridor junction {junction.junction_name} "
                    f"(sequence {junction.sequence_order}). Proposing green corridor for {test_hold_sec}s."
                )

            actions.append({
                "junction_id": junction.junction_id,
                "junction_name": junction.junction_name,
                "sequence_order": junction.sequence_order,
                "action": action_type,
                "target_signal_state": "GREEN",
                "hold_duration_seconds": test_hold_sec,
                "reason": reason,
            })

        overall_reason = (
            f"[Test/Demo Fallback] Generated synthetic signal clearance proposal for "
            f"{num_junctions} junctions along route '{request.route_name}' for vehicle "
            f"{request.vehicle_id} ({request.vehicle_type}). This proposal uses default "
            f"test/demo fallback timing ({test_hold_sec}s) and does not represent project "
            f"traffic-control policy."
        )

        return {
            "reasoning": overall_reason,
            "actions": actions,
        }

    async def _call_gemini_api(self, request: SignalActionAgentRequest) -> Dict[str, Any]:
        """Invoke Gemini API to obtain signal action reasoning."""
        prompt = self._build_gemini_prompt(request)
        url = f"{GEMINI_API_BASE_URL}/{self.model}:generateContent"
        params = {"key": self.api_key}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, params=params, json=payload)
            resp.raise_for_status()
            data = resp.json()

        text_content = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "{}")
        )
        return json.loads(text_content)

    def _build_gemini_prompt(self, request: SignalActionAgentRequest) -> str:
        """Construct the prompt instructing Gemini on signal action proposal rules."""
        junctions_data = [
            {
                "junction_id": j.junction_id,
                "junction_name": j.junction_name,
                "sequence_order": j.sequence_order,
                "current_signal_state": j.current_signal_state,
                "distance_meters": j.distance_meters,
            }
            for j in request.ordered_junctions
        ]

        return f"""You are the Signal Action Agent for an emergency management simulation system.
Your role: Analyze an emergency vehicle's route and ordered junctions, then propose non-destructive traffic signal actions to clear the vehicle's path.

SAFETY RULE: You do NOT execute signal changes. You only output structured proposals.

Emergency Context:
- Session ID: {request.emergency_session_id}
- Vehicle ID: {request.vehicle_id}
- Vehicle Type: {request.vehicle_type}
- Route ID: {request.route_id}
- Route Name: {request.route_name}
- Ordered Junctions along Route: {json.dumps(junctions_data, indent=2)}

Allowed Action Types:
- GREEN_CORRIDOR: Hold or switch signal to green along emergency direction.
- HOLD_RED: Hold cross-traffic red to prevent gridlock.
- PRIORITY_TRANSITION: Safe accelerated phase change from red/yellow to green.
- CAUTION_FLASH: Flashing yellow for low-conflict junction.

You must return valid JSON with this exact schema:
{{
  "reasoning": "Overall strategic summary of the green wave clearance plan",
  "actions": [
    {{
      "junction_id": "<exact junction_id from route>",
      "junction_name": "<exact junction_name>",
      "sequence_order": <integer matching route sequence>,
      "action": "<one of GREEN_CORRIDOR, HOLD_RED, PRIORITY_TRANSITION, CAUTION_FLASH>",
      "target_signal_state": "GREEN",
      "hold_duration_seconds": <integer between 5 and 300>,
      "reason": "<specific justification for this junction>"
    }}
  ]
}}

CRITICAL CONSTRAINTS & INSTRUCTIONS:
1. Every junction in 'actions' MUST correspond to a junction provided in the route.
2. The order of 'actions' MUST match the sequence_order of the route.
3. Every junction along the route must be assigned an action.
4. TIMING & TELEMETRY CONSTRAINT: Vehicle speed is NOT provided in the input telemetry. Do NOT assume, invent, or claim to determine timing based on vehicle speed or unprovided speed calculations. Determine appropriate safe clearance windows (between 5 and 300 seconds) based solely on junction sequence, current signal states, and route layout.
"""
