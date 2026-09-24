"""Controlled read-only corridor tools for the Signal Action Agent.

Provides least-privilege, read-only tools to retrieve:
1. Selected route context
2. Ordered route junctions
3. Current signal states

CRITICAL SAFETY & LEAST-PRIVILEGE INVARIANTS:
- All tools are strictly READ-ONLY.
- No database write operations, updates, or deletions are permitted.
- No signal execution or phase preemption calls can be made through these tools.
- No emergency session completion or cancellation can be triggered.
- Returns ONLY the minimum corridor navigation telemetry required for reasoning.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Least-Privilege Domain Models for Tool Responses
# ---------------------------------------------------------------------------

class SelectedRouteContext(BaseModel):
    """Least-privilege read-only view of a selected emergency route."""

    route_id: str = Field(..., description="Unique route identifier")
    route_name: str = Field(..., description="Route corridor name")
    start_location: str = Field(..., description="Origin location")
    destination: str = Field(..., description="Target destination")
    distance_km: float = Field(..., description="Total route distance in kilometers")
    traffic_level: str = Field(..., description="Current corridor traffic density level")
    estimated_time_minutes: Optional[int] = Field(
        default=None, description="Estimated traversal duration in minutes"
    )


class OrderedRouteJunction(BaseModel):
    """Least-privilege read-only view of a junction along a route."""

    junction_id: str = Field(..., description="Unique junction identifier")
    junction_name: str = Field(..., description="Human-readable junction name")
    sequence_order: int = Field(..., ge=1, description="Order of junction along corridor")
    current_signal_state: str = Field(
        default="RED", description="Current signal state at approach (RED, GREEN, YELLOW)"
    )
    distance_meters: Optional[float] = Field(
        default=None, description="Optional distance telemetry in meters"
    )


class JunctionSignalState(BaseModel):
    """Least-privilege read-only view of a junction signal state."""

    junction_id: str = Field(..., description="Unique junction identifier")
    current_signal_state: str = Field(..., description="Current approach signal state")


# ---------------------------------------------------------------------------
# Simulation Fallback Catalog (Used for offline testing and resilience)
# ---------------------------------------------------------------------------

SIMULATION_CATALOG: Dict[str, Dict[str, Any]] = {
    # Route A (from project seed data)
    "22222222-2222-2222-2222-222222222201": {
        "route_id": "22222222-2222-2222-2222-222222222201",
        "route_name": "Route A",
        "start_location": "Peradeniya",
        "destination": "Kandy",
        "distance_km": 5.0,
        "traffic_level": "HIGH",
        "estimated_time_minutes": 15,
        "junctions": [
            {
                "junction_id": "11111111-1111-1111-1111-111111111101",
                "junction_name": "Peradeniya Junction",
                "sequence_order": 1,
                "current_signal_state": "GREEN",
                "distance_meters": 300.0,
            },
            {
                "junction_id": "11111111-1111-1111-1111-111111111102",
                "junction_name": "Gatambe Junction",
                "sequence_order": 2,
                "current_signal_state": "GREEN",
                "distance_meters": 800.0,
            },
            {
                "junction_id": "11111111-1111-1111-1111-111111111104",
                "junction_name": "Town Junction",
                "sequence_order": 3,
                "current_signal_state": "RED",
                "distance_meters": 1400.0,
            },
            {
                "junction_id": "11111111-1111-1111-1111-111111111105",
                "junction_name": "Lake Junction",
                "sequence_order": 4,
                "current_signal_state": "RED",
                "distance_meters": 2100.0,
            },
        ],
    },
    # Route B (from project seed data)
    "22222222-2222-2222-2222-222222222202": {
        "route_id": "22222222-2222-2222-2222-222222222202",
        "route_name": "Route B",
        "start_location": "Peradeniya",
        "destination": "Hospital Gate",
        "distance_km": 3.8,
        "traffic_level": "MEDIUM",
        "estimated_time_minutes": 10,
        "junctions": [
            {
                "junction_id": "11111111-1111-1111-1111-111111111101",
                "junction_name": "Peradeniya Junction",
                "sequence_order": 1,
                "current_signal_state": "GREEN",
                "distance_meters": 300.0,
            },
            {
                "junction_id": "11111111-1111-1111-1111-111111111102",
                "junction_name": "Gatambe Junction",
                "sequence_order": 2,
                "current_signal_state": "GREEN",
                "distance_meters": 800.0,
            },
            {
                "junction_id": "11111111-1111-1111-1111-111111111103",
                "junction_name": "Hospital Junction",
                "sequence_order": 3,
                "current_signal_state": "RED",
                "distance_meters": 1200.0,
            },
        ],
    },
    # Test fixture corridor
    "route_colombo_kandy_01": {
        "route_id": "route_colombo_kandy_01",
        "route_name": "Colombo to Kandy Priority Corridor",
        "start_location": "Colombo West",
        "destination": "Hospital Gate West",
        "distance_km": 115.0,
        "traffic_level": "HIGH",
        "estimated_time_minutes": 90,
        "junctions": [
            {
                "junction_id": "junc_01",
                "junction_name": "Main Street & 1st Avenue",
                "sequence_order": 1,
                "current_signal_state": "RED",
                "distance_meters": 250.0,
            },
            {
                "junction_id": "junc_02",
                "junction_name": "Main Street & Central Cross",
                "sequence_order": 2,
                "current_signal_state": "GREEN",
                "distance_meters": 600.0,
            },
            {
                "junction_id": "junc_03",
                "junction_name": "Hospital Gate West",
                "sequence_order": 3,
                "current_signal_state": "RED",
                "distance_meters": 1100.0,
            },
        ],
    },
}


# ---------------------------------------------------------------------------
# Read-Only Corridor Tool Client
# ---------------------------------------------------------------------------

class ReadOnlyCorridorToolClient:
    """Client for read-only corridor queries enforcing least privilege.

    This client:
    - Only issues HTTP GET requests.
    - Explicitly blocks any mutating HTTP requests (POST, PUT, DELETE, PATCH).
    - Cannot activate signals, alter state, or modify the database.
    - Falls back gracefully to simulation catalog data if the ASP.NET backend
      is offline or when testing synthetic simulation routes.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 3.0,
        catalog: Optional[Dict[str, Any]] = None,
    ):
        self.base_url = (base_url or settings.BACKEND_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.catalog = catalog if catalog is not None else SIMULATION_CATALOG

    @property
    def is_read_only(self) -> bool:
        """Guarantee that this client operates in strictly read-only mode."""
        return True

    def execute_signal_change(self, *args, **kwargs):
        """Disallowed: The AI service cannot execute signal changes."""
        raise PermissionError(
            "Read-only tool constraint: execute_signal_change is forbidden. "
            "AI agents only output proposals."
        )

    def activate_green_wave(self, *args, **kwargs):
        """Disallowed: Green wave activation must be done by the ASP.NET backend."""
        raise PermissionError(
            "Read-only tool constraint: activate_green_wave is forbidden."
        )

    def complete_emergency(self, *args, **kwargs):
        """Disallowed: Modifying emergency session status is forbidden."""
        raise PermissionError(
            "Read-only tool constraint: complete_emergency is forbidden."
        )

    async def get_selected_route_context(
        self, route_id: str
    ) -> Optional[SelectedRouteContext]:
        """Tool 1: Retrieve minimal, least-privilege route context for a given route_id."""
        if not route_id:
            return None

        # 1. Try querying the live ASP.NET backend read-only endpoint
        try:
            url = f"{self.base_url}/routes/{route_id}"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    return SelectedRouteContext(
                        route_id=str(data.get("routeId", route_id)),
                        route_name=str(data.get("routeName", "")),
                        start_location=str(data.get("startLocation", "")),
                        destination=str(data.get("destination", "")),
                        distance_km=float(data.get("distanceKm", 0.0)),
                        traffic_level=str(data.get("trafficLevel", "UNKNOWN")),
                        estimated_time_minutes=data.get("estimatedTimeMinutes"),
                    )
                elif resp.status_code == 404:
                    logger.info("Route %s not found on backend (404).", route_id)
        except Exception as e:
            logger.debug(
                "Backend GET /routes/%s unavailable (%s); checking simulation catalog.",
                route_id,
                e,
            )

        # 2. Check offline simulation fallback catalog
        if route_id in self.catalog:
            cat_data = self.catalog[route_id]
            return SelectedRouteContext(
                route_id=cat_data["route_id"],
                route_name=cat_data["route_name"],
                start_location=cat_data["start_location"],
                destination=cat_data["destination"],
                distance_km=cat_data["distance_km"],
                traffic_level=cat_data["traffic_level"],
                estimated_time_minutes=cat_data.get("estimated_time_minutes"),
            )

        return None

    async def get_ordered_route_junctions(
        self, route_id: str
    ) -> List[OrderedRouteJunction]:
        """Tool 2: Retrieve ordered junctions along the selected corridor."""
        if not route_id:
            return []

        # 1. Try querying the live ASP.NET backend read-only endpoint
        try:
            url = f"{self.base_url}/routes/{route_id}"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_junctions = data.get("junctions", [])
                    # Sort junctions by sequence number
                    sorted_raw = sorted(
                        raw_junctions, key=lambda x: x.get("sequenceNumber", 0)
                    )
                    return [
                        OrderedRouteJunction(
                            junction_id=str(j.get("junctionId", "")),
                            junction_name=str(j.get("junctionName", "")),
                            sequence_order=int(j.get("sequenceNumber", idx + 1)),
                            current_signal_state=str(
                                j.get("currentSignalState", "RED")
                            ),
                        )
                        for idx, j in enumerate(sorted_raw)
                    ]
        except Exception as e:
            logger.debug(
                "Backend GET /routes/%s junctions unavailable (%s); checking simulation catalog.",
                route_id,
                e,
            )

        # 2. Check offline simulation fallback catalog
        if route_id in self.catalog:
            cat_data = self.catalog[route_id]
            raw_junctions = cat_data.get("junctions", [])
            sorted_raw = sorted(
                raw_junctions, key=lambda x: x.get("sequence_order", 0)
            )
            return [
                OrderedRouteJunction(
                    junction_id=j["junction_id"],
                    junction_name=j["junction_name"],
                    sequence_order=j["sequence_order"],
                    current_signal_state=j.get("current_signal_state", "RED"),
                    distance_meters=j.get("distance_meters"),
                )
                for j in sorted_raw
            ]

        return []

    async def get_junction_signal_states(
        self, route_id: str, junction_ids: Optional[List[str]] = None
    ) -> Dict[str, str]:
        """Tool 3: Retrieve current signal states for junctions along the corridor."""
        junctions = await self.get_ordered_route_junctions(route_id)
        target_ids = set(junction_ids) if junction_ids else None

        signal_states: Dict[str, str] = {}
        for j in junctions:
            if target_ids is None or j.junction_id in target_ids:
                signal_states[j.junction_id] = j.current_signal_state

        return signal_states


# ---------------------------------------------------------------------------
# Standalone Tool Functions
# ---------------------------------------------------------------------------

async def get_selected_route_context(
    route_id: str, client: Optional[ReadOnlyCorridorToolClient] = None
) -> Optional[SelectedRouteContext]:
    """Retrieve least-privilege route context for a selected route."""
    c = client or ReadOnlyCorridorToolClient()
    return await c.get_selected_route_context(route_id)


async def get_ordered_route_junctions(
    route_id: str, client: Optional[ReadOnlyCorridorToolClient] = None
) -> List[OrderedRouteJunction]:
    """Retrieve ordered junctions along a selected route corridor."""
    c = client or ReadOnlyCorridorToolClient()
    return await c.get_ordered_route_junctions(route_id)


async def get_junction_signal_states(
    route_id: str,
    junction_ids: Optional[List[str]] = None,
    client: Optional[ReadOnlyCorridorToolClient] = None,
) -> Dict[str, str]:
    """Retrieve current approach signal states for junctions along a route."""
    c = client or ReadOnlyCorridorToolClient()
    return await c.get_junction_signal_states(route_id, junction_ids=junction_ids)
