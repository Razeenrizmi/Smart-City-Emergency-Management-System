# Emergency Green Wave — Signal Action Agent AI Service

This service provides the AI component for the **Emergency Green Wave** sub-system within the **Smart City Emergency Management System**.

## Role & System Boundary

- **Component:** Emergency Green Wave
- **Agent Identity:** Signal Action Agent
- **Execution Model:** Simulation system
- **Safety Principle:** The AI agent **does not directly execute signal changes**. Instead, it analyzes emergency vehicle route and junction telemetry, then produces a **structured signal action proposal** (status: `PROPOSED`) that is subsequently validated and dispatched to the existing ASP.NET Core Green Wave backend.
- **Architectural Fit:** Built on FastAPI, Pydantic, and LangGraph workflow patterns with Google Gemini models, designed for future composition into the group multi-agent supervisor architecture.

---

## Directory Structure

```text
ai-service/
├── app/
│   ├── __init__.py           # Package initializer
│   ├── main.py               # FastAPI application entrypoint with health & agent routes
│   ├── config.py             # Pydantic Settings configuration (loads .env)
│   ├── agents/               # Signal Action Agent implementation
│   │   ├── __init__.py
│   │   ├── router.py         # FastAPI router for agent endpoints
│   │   └── signal_action_agent.py # Agent orchestration class
│   ├── tools/                # Agent tools & deterministic safety validator
│   │   ├── __init__.py
│   │   └── validator.py      # Route & sequence safety invariant validator
│   ├── graph/                # 4-stage state graph workflow (LangGraph pattern)
│   │   ├── __init__.py
│   │   ├── nodes.py          # Stage node functions (context, reasoning, proposal, validation)
│   │   ├── state.py          # AgentState TypedDict schema
│   │   └── workflow.py       # Compiled state graph runner
│   ├── models/               # Pydantic data schemas & proposal contracts
│   │   ├── __init__.py
│   │   └── schemas.py        # Input & output models, enums (SignalActionType, ProposalStatus)
│   └── services/             # External integration services
│       ├── __init__.py
│       └── gemini_service.py # Gemini LLM client & deterministic mock engine
├── tests/
│   ├── __init__.py
│   ├── test_health.py        # Health endpoint test suite
│   └── test_signal_action_agent.py # Agent unit, safety, and integration test suite
├── .env.example              # Environment configuration template (never commit real keys)
├── .gitignore                # Python and environment ignore rules
├── requirements.txt          # Python package dependencies
└── README.md                 # Setup, architecture, and verification documentation
```

---

## 4-Stage Agent Workflow

The Signal Action Agent executes an explicit, sequential state graph:

```text
  [START]
     │
     ▼
[Stage 1: input_context]
     │  - Ingests emergency vehicle ID, type, route ID, and ordered junctions.
     │  - Normalizes and validates sequence order.
     ▼
[Stage 2: reasoning]
     │  - Ingests corridor telemetry into Gemini LLM (or deterministic mock).
     │  - Formulates optimal clearing timings based on vehicle priority.
     ▼
[Stage 3: structured_proposal]
     │  - Converts model output into strongly-typed JunctionAction objects.
     │  - Assigns hold durations (5-300s), target states (GREEN), and justifications.
     ▼
[Stage 4: validation]
     │  - Strictly verifies all proposed junctions belong to the route.
     │  - Verifies traversal sequence order is strictly preserved.
     │  - Rejects unauthorized action types or empty routes.
     │  - Enforces status strictly as PROPOSED (never executed).
     ▼
   [END]
```

---

## Prerequisites

- **Python:** 3.10, 3.11, or 3.12 (Python 3.12 recommended)
- **Google Gemini API Key:** Optional for offline testing (service includes full deterministic mock mode), required for live LLM reasoning. Get a key at [Google AI Studio](https://aistudio.google.com/).

---

## Setup Instructions

### 1. Navigate to the Service Directory

```bash
cd ai-service
```

### 2. Create a Virtual Environment

**On Windows:**
```powershell
python -m venv .venv
```

**On Linux / macOS:**
```bash
python3 -m venv .venv
```

### 3. Activate the Virtual Environment

**Windows PowerShell:**
```powershell
.\.venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
source .venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables

```powershell
copy .env.example .env
```

Edit `.env`:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
BACKEND_BASE_URL=http://localhost:5017/api
```

---

## Running the Service

Start the FastAPI application with Uvicorn:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Available endpoints:
- **Root Status:** `GET http://localhost:8000/`
- **Health Check:** `GET http://localhost:8000/health`
- **Signal Proposal Endpoint:** `POST http://localhost:8000/api/v1/agent/propose-signals`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`

---

## API Usage Example

### Request: `POST /api/v1/agent/propose-signals`

```json
{
  "emergency_session_id": "sess-colombo-ambulance-01",
  "vehicle_id": "AMBULANCE-01",
  "vehicle_type": "Ambulance",
  "route_id": "route-fort-hospital",
  "route_name": "Fort to General Hospital Express",
  "ordered_junctions": [
    {
      "junction_id": "junc-01",
      "junction_name": "Fort Station Roundabout",
      "sequence_order": 1,
      "distance_meters": 300.0,
      "current_signal_state": "RED"
    },
    {
      "junction_id": "junc-02",
      "junction_name": "Galle Face Intersection",
      "sequence_order": 2,
      "distance_meters": 750.0,
      "current_signal_state": "RED"
    },
    {
      "junction_id": "junc-03",
      "junction_name": "Hospital Gate West",
      "sequence_order": 3,
      "distance_meters": 1400.0,
      "current_signal_state": "GREEN"
    }
  ]
}
```

*(Append `?mock_mode=true` to test deterministic reasoning without an external API key)*

### Response: `200 OK`

```json
{
  "proposal_id": "prop_a1b2c3d4e5f6",
  "emergency_session_id": "sess-colombo-ambulance-01",
  "route_id": "route-fort-hospital",
  "route_name": "Fort to General Hospital Express",
  "vehicle_id": "AMBULANCE-01",
  "vehicle_type": "Ambulance",
  "proposal_status": "PROPOSED",
  "proposed_junction_actions": [
    {
      "junction_id": "junc-01",
      "junction_name": "Fort Station Roundabout",
      "sequence_order": 1,
      "action": "PRIORITY_TRANSITION",
      "target_signal_state": "GREEN",
      "hold_duration_seconds": 45,
      "reason": "Immediate junction Fort Station Roundabout is currently RED. Initiating priority transition to GREEN with 45s clearance window."
    },
    {
      "junction_id": "junc-02",
      "junction_name": "Galle Face Intersection",
      "sequence_order": 2,
      "action": "GREEN_CORRIDOR",
      "target_signal_state": "GREEN",
      "hold_duration_seconds": 50,
      "reason": "Intermediate corridor junction Galle Face Intersection (sequence 2). Coordinating green wave with 50s clearance duration."
    },
    {
      "junction_id": "junc-03",
      "junction_name": "Hospital Gate West",
      "sequence_order": 3,
      "action": "GREEN_CORRIDOR",
      "target_signal_state": "GREEN",
      "hold_duration_seconds": 55,
      "reason": "Terminal junction Hospital Gate West leading to destination corridor. Holding GREEN for 55s to avoid bottleneck on approach."
    }
  ],
  "reason": "Analyzed 3 junctions along route 'Fort to General Hospital Express' for emergency vehicle AMBULANCE-01 (Ambulance). Recommended sequential green corridor progression to minimize stopping time while maintaining safe clearance margins.",
  "validation_notes": [
    "VALIDATION PASSED: Verified 3 junction actions along route. All junctions belong to route, order strictly preserved, actions within allowed set. Marked as PROPOSED (not executed)."
  ],
  "timestamp": "2026-09-24T08:05:34.228371Z"
}
```

---

## Running Tests

Run the full automated test suite (including safety invariant validation and endpoint integration):

```bash
pytest -v
```
