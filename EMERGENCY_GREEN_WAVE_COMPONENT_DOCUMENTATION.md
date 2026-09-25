# SE3090 – Software Engineering Frameworks

## Emergency Green Wave — Individual Component

**Student:** IT24102656 — Shazna M.M.
**Primary Component:** Emergency Green Wave
**Project:** Smart City Emergency Management System
**Technology:** ASP.NET Core Web API, PostgreSQL, React, Flutter, Python/LangGraph

---

## 1. Component Purpose

The **Emergency Green Wave** component manages emergency-vehicle traffic-signal preemption.

The component allows an emergency vehicle to select a route, create an emergency session, obtain an AI-generated Green Wave proposal, pass the proposal through human approval, activate the Green Wave through the ASP.NET Core backend, and complete the emergency while restoring the original signal states.

The component is integrated through the project's shared:

**Flutter → ASP.NET Core → PostgreSQL**
**React → ASP.NET Core → PostgreSQL**

The Python/LangGraph AI service is accessed **through ASP.NET Core**, not directly by Flutter or React.

---

# 2. Assignment-Relevant Architecture

```text
                    ┌─────────────────────┐
                    │   Flutter Mobile    │
                    │ Emergency Vehicle   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    ASP.NET Core     │
                    │      Web API        │
                    │                     │
                    │ Business Rules      │
                    │ Validation          │
                    │ AI Integration      │
                    │ Green Wave Execution│
                    └──────┬────────┬─────┘
                           │        │
                    ┌──────┘        └──────────┐
                    ▼                          ▼
          ┌─────────────────┐       ┌─────────────────┐
          │ Python/LangGraph│       │   PostgreSQL    │
          │    AI Service   │       │                 │
          └────────┬────────┘       │ Routes          │
                   │                │ Junctions       │
                   │                │ Emergencies     │
                   ▼                │ AI Workflow     │
          ┌─────────────────┐       │ Preemption Logs │
          │ AI Proposal +   │       └─────────────────┘
          │ Validation      │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ Human Operator  │
          │ Approve/Reject  │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ ASP.NET Final   │
          │ Validation      │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ Green Wave      │
          │ Execution       │
          └─────────────────┘

                    ▲
                    │
          ┌─────────┴─────────┐
          │    React Web      │
          │ Operator Dashboard│
          └───────────────────┘
```

**Core architectural rule:**

> **AI proposes → Human approves → ASP.NET validates and executes.**

The AI service never directly changes traffic-signal states.

---

# 3. Emergency Green Wave Workflow

```text
Emergency Vehicle
       │
       ▼
Select Route
       │
       ▼
Create Emergency Session
       │
       ▼
AI Proposal
       │
       ▼
AI Validation
       │
       ▼
Human Approval
    │       │
 REJECT   APPROVE
    │       │
    ▼       ▼
  Stop   Handoff Ready
              │
              ▼
       ASP.NET Validation
              │
              ▼
       Green Wave Activation
              │
              ▼
       Junctions → GREEN
              │
              ▼
       Emergency Vehicle Passes
              │
              ▼
       Complete Emergency
              │
              ▼
       Restore Previous
       Signal States
```

---

# 4. Agentic AI / Human-in-the-Loop

The component uses the project's **Python/LangGraph Agentic AI workflow** for the Green Wave decision process.

### AI responsibilities

* Receive the emergency/route context.
* Generate a structured Green Wave proposal.
* Validate the proposal.
* Maintain workflow/proposal state.
* Provide the proposal for human review.
* Process the approval/rejection workflow.
* Produce a `handoffReady` state for the backend.

### Human responsibility

The human/operator reviews the AI proposal and explicitly:

* **Approves** the proposal, or
* **Rejects** the proposal.

A Green Wave cannot be activated merely because the AI generated a proposal.

### Backend responsibility

ASP.NET Core verifies:

```text
Workflow exists
       AND
Proposal is valid
       AND
Approval = APPROVED
       AND
HandoffReady = true
       AND
Emergency Session = ACTIVE
       AND
Route exists
       AND
Route contains junctions
       AND
No active Green Wave already exists
```

Only then can Green Wave execution modify junction states.

---

# 5. Business Logic

### Green Wave Activation

For the selected route, junctions are processed according to their `sequence_number`.

For each junction:

1. Read the current signal state.
2. Store it as `PreviousSignalState`.
3. Change the junction to `GREEN`.
4. Create an active signal-preemption record.

### Green Wave Completion

When the emergency is completed:

1. Read each preemption record.
2. Restore its recorded `PreviousSignalState`.
3. Deactivate the preemption record.
4. Mark the emergency session `COMPLETED`.

The system therefore restores the **actual previous state** rather than resetting every junction to one fixed state.

### Cancellation

An emergency can also be cancelled:

```text
ACTIVE → CANCELLED
```

Cancellation does not perform the completion/restoration workflow.

---

# 6. Database Contribution

The component uses PostgreSQL with Entity Framework Core.

### Main tables used

| Table                         | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `EMERGENCY_SESSIONS`          | Emergency session and selected route                |
| `ROUTES`                      | Emergency routes                                    |
| `ROUTE_JUNCTIONS`             | Ordered junctions belonging to routes               |
| `ROAD_JUNCTIONS`              | Junction and signal-state information               |
| `SIGNAL_PREEMPTION_LOGS`      | Green Wave activation and previous signal states    |
| `AI_WORKFLOW_EXECUTIONS`      | AI proposal, validation, approval and handoff state |
| `SIGNAL_ADJUSTMENT_PROPOSALS` | AI-related signal proposals                         |

### Route relationship

```text
ROUTES
   │
   ├── ROUTE_JUNCTIONS ──► ROAD_JUNCTIONS
   │
   └── EMERGENCY_SESSIONS
```

The selected route determines the ordered junction sequence used by the Green Wave.

---

# 7. ASP.NET Core Contribution

The backend is the authoritative layer for the component.

It handles:

* Route retrieval.
* Emergency session creation and retrieval.
* AI workflow integration.
* AI proposal persistence.
* Human approval state.
* Green Wave activation.
* Signal preemption logging.
* Signal restoration.
* Emergency completion.
* Emergency cancellation.
* Business-rule validation.

Important Green Wave operation:

```text
POST /api/emergencies/{id}/activate-green-wave
```

The endpoint cannot execute the Green Wave unless the required AI approval and handoff conditions are satisfied.

---

# 8. React Contribution

The React Emergency Green Wave interface provides the operator-side workflow.

It displays:

* Emergency information.
* Selected route.
* AI workflow status.
* Proposal status.
* Validation status.
* Approval status.
* Handoff status.
* Green Wave execution status.

The React application communicates with the ASP.NET Core API and does not directly call the Python AI service.

---

# 9. Flutter Contribution

The Flutter application provides the emergency-vehicle workflow.

```text
Home
  ↓
Route List
  ↓
Route Details
  ↓
Create Emergency
  ↓
Emergency Session
  ↓
AI Workflow Status
  ↓
Green Wave Activation
  ↓
Completion / Cancellation
```

The emergency session screen displays the relevant AI workflow state and only enables Green Wave activation when the backend-required approval conditions are satisfied.

---

# 10. Agentic AI State

The AI workflow state persisted through the backend includes information such as:

* Workflow status
* Proposal status
* Validation result
* Approval status
* Approval user
* Approval time
* Approval notes
* Handoff readiness
* Green Wave execution information

The system exposes the persisted workflow state to the React and Flutter clients.

---

# 11. Testing Evidence

The component has automated tests across the implemented layers.

| Area                         |                                      Completed Result |
| ---------------------------- | ----------------------------------------------------: |
| ASP.NET Core component tests |                                          **8 passed** |
| React tests                  |                                          **7 passed** |
| React lint                   |                                            **Passed** |
| React production build       |                                            **Passed** |
| Flutter tests                |                                          **7 passed** |
| Agentic AI test suite        | **54 passed, 1 skipped** in the completed AI test run |

### Backend tests specifically verify

* Missing AI workflow is rejected.
* Unapproved workflow is rejected.
* `HandoffReady = false` is rejected.
* Approved + handoff-ready workflow can activate Green Wave.
* Rejected activation produces no Green Wave side effects.

### Frontend tests verify

* AI workflow state display.
* Emergency details.
* Activation conditions.
* Workflow polling/state refresh.
* Completion/cancellation behaviour.

---

# 12. Individual Component Scope

The **Emergency Green Wave** component therefore covers:

```text
Emergency Route
      +
Emergency Session
      +
AI Green Wave Proposal
      +
AI Validation
      +
Human Approval
      +
Backend Approval Guard
      +
Green Wave Signal Preemption
      +
Previous-State Restoration
      +
React Operator Workflow
      +
Flutter Emergency Workflow
      +
PostgreSQL Persistence
      +
Automated Testing
```

### Final responsibility boundary

```text
┌──────────────┐
│ AI / LangGraph│
│ RECOMMENDS    │
└──────┬───────┘
       ▼
┌──────────────┐
│ Human        │
│ APPROVES     │
└──────┬───────┘
       ▼
┌──────────────┐
│ ASP.NET Core │
│ VALIDATES    │
│ + EXECUTES   │
└──────┬───────┘
       ▼
┌──────────────┐
│ PostgreSQL   │
│ PERSISTS     │
└──────────────┘
```

**Emergency Green Wave = route-based emergency traffic preemption controlled through a validated Agentic AI proposal and human approval, with ASP.NET Core as the authoritative execution layer.**
