# SE3110 — Software Test Plan

## Smart City Emergency Management System (SE3090)
### Road Hazard Detection Mobile Subsystem — Individual Component

| Field | Value |
|---|---|
| **Document** | Software Test Plan (STP) |
| **Module / Unit** | SE3110 Quality Management |
| **Component under test** | Road Hazard Detection & Municipal Repair Dispatch |
| **Subsystem owner** | [Your Name] — [Your IT Number] |
| **Group project** | Smart City Emergency Management System (SE3090) |
| **Version / Date** | 1.0 — [dd/mm/yyyy] |
| **Status** | For evaluation |

> **Copy‑paste note:** this is a Markdown file. If your Word template does not render the tables
> on paste, paste through a Markdown preview, or use Word **Insert → Table → Convert Text to Table**.

---

## 1. Introduction & Objectives

This Test Plan defines the strategy, scope, tools, environments, criteria and evidence for verifying the
**Road Hazard Detection** subsystem — a citizen/driver road‑hazard reporting and municipal dispatch
pipeline that spans four technologies:

1. **Flutter mobile app** — sensor‑driven hazard capture (accelerometer spike detection, continuous GPS,
   photo attachment, manual report, AI badge).
2. **ASP.NET Core Web API** — hazard ingestion, severity scoring, officer approval, AI vision + analyst endpoints.
3. **PostgreSQL (EF Core)** — hazard persistence, AI workflow audit, approval state machine.
4. **React municipal dashboard** — hazard map rendering and officer approval/verification.

The objectives are to:

- **O1** Verify that a driver‑detected or manually created road hazard is correctly captured on the phone
  (correct coordinates, correct severity, optional photo) and posted to the API.
- **O2** Verify that the backend **validates input** (geo ranges, null‑island rejection), computes severity,
  persists the report and exposes it to the officer queue and the public map.
- **O3** Verify the **approval state machine** (`PENDING → APPROVED / REJECTED → RESOLVED`) and its
  **role‑based access control** (only `MUNICIPAL_OFFICER` may approve/reject).
- **O4** Verify **device‑permission handling** (location, camera/gallery) including graceful degradation
  when a permission is denied or revoked.
- **O5** Verify the **AI hazard triage** path (image classification, confidence scoring, auto‑verification
  threshold) and the city **Road Danger Index** analytics.
- **O6** Verify **non‑functional** quality: the hazard write path holds its service level under **100+
  concurrent reporters** (performance) and the hazard/auth endpoints resist common attacks (security).
- **O7** Produce **repeatable, automated evidence** (TRX, JUnit, LCOV, Newman HTML, k6 JSON) suitable for
  the individual 60 % and the group 40 % assessment.

---

## 2. Scope

### 2.1 In scope (Road Hazard Detection — individual)

| # | Functional area | Representative behaviour under test |
|---|---|---|
| S1 | Hazard capture (mobile) | Accelerometer spike detection at the 11.5 m/s² threshold, 5‑second cooldown, manual force‑report |
| S2 | Location capture | Continuous GPS position stream attached at report time; accuracy surfaced in UI |
| S3 | Media attachment | Camera/gallery picker (image_picker), photo quality/resize, optional classification |
| S4 | Device permissions | Location granted / denied / denied‑forever; camera & gallery access; graceful fallback |
| S5 | Map & proximity | Hazard pins rendered by severity; resolved/null‑island filtering |
| S6 | Offline / network loss | Behaviour when the report POST times out or the device is offline (see §3 note) |
| S7 | Backend ingestion | `POST /api/hazards/report` — validation, severity mapping, persistence |
| S8 | Officer workflow | `GET /api/hazards/pending`, `PUT /…/{id}/approve`, `PUT /…/{id}/reject` + RBAC |
| S9 | AI triage | `POST /api/ai/classify-image` classification, confidence, auto‑verify; `GET /api/ai/insights` |
| S10 | Dashboard | React hazard map markers, popup formatting, filtering, API‑error state |

### 2.2 Out of scope (individual)

- Emergency Green Wave signal pre‑emption, crime‑vehicle (ANPR) surveillance and CCTV telemetry — owned by
  other group members (group coverage is summarised in §11).
- Municipal worker mobile workflows beyond the assignment/dispatch boundary.

### 2.3 Out of scope by design (not implemented in the codebase)

The following appear in the component brief but are **not implemented** in the current code. They are
listed here so the plan is honest; the artifacts flag each one and the viva guide shows how to defend them.

| Brief expectation | Reality in this codebase | Where |
|---|---|---|
| Google Maps SDK integration | Mobile uses **`flutter_map` + `latlong2`** (OpenStreetMap tiles); dashboard uses **Leaflet (`react-leaflet`)**. Google appears only as an optional tile provider on the web map. | `mobile/pubspec.yaml`, `mobile/lib/widgets/interactive_navigation_map.dart`, `web/src/components/HazardMap.jsx` |
| Dedicated agentic AI hazard‑triage service (`ai-service/`) | `ai-service/` implements the **Green Wave signal agent**. Hazard AI triage lives **inside ASP.NET Core** as `AiVisionService` (`POST /api/ai/classify-image`) and `AiAnalystService` (`/api/ai/insights`, `/api/ai/chat`). | `backend/SRMS.API/Services/AiVisionService.cs`, `Controllers/AiController.cs` |
| Offline report queueing & retry | **Not implemented.** `HazardApiService.postHazardReport` wraps the call in a try/catch and returns `{success:false}` on failure — no queue, no retry, no connectivity detection. | `mobile/lib/services/hazard_api_service.dart` |
| Multipart image‑upload endpoint | **None.** The photo is a nullable `ImageUrl` string on the report; classification is a separate JSON call carrying base64. | `Models/RoadHazardReport.cs`, `AiController.ClassifyImage` |
| Testcontainers for DB tests | Tests run against a **real PostgreSQL** (`srms_test`) via `TEST_POSTGRES_CONNECTION`, serialized by `[Collection("HazardsDb")]`. An optional Testcontainers variant is provided as a template only. | `backend/SRMS.API.Tests/Support/*` |
| Playwright for the dashboard | Dashboard tests use **Vitest + React Testing Library** (`jsdom`). Playwright is a roadmap item only. | `web/src/test/HazardMap.test.jsx` |

---

## 3. Test Items & Architecture Under Test

```
┌──────────────────────────┐        ┌───────────────────────────┐        ┌──────────────────────┐
│  Flutter (mobile)        │  POST  │  ASP.NET Core Web API     │  EF    │  PostgreSQL          │
│  HazardDetectionScreen   │ ─────► │  HazardsController        │ ─────► │  RoadHazardReports   │
│   • accelerometer 11.5   │ /report│   • geo validation        │        │  AiWorkflowExecutions│
│   • GPS positionStream   │        │   • severity 1–5          │        │  (schema via         │
│   • image_picker         │        │   • approval state machine│        │   EF Core migrations)│
│   • AiApiService ────────┼────────► AiController /classify-image ┘        └──────────────────────┘
└──────────────────────────┘        │   • AiVisionService (auto‑verify ≥0.75)
                                    │   • AiAnalystService (RDI, clusters)
┌──────────────────────────┐  GET   │  JWT bearer + RBAC        │
│  React dashboard         │ ─────► │  [Authorize(Roles=…)]     │
│  HazardMap (Leaflet)     │ /all   └───────────────────────────┘
│  PendingApprovalsView    │ /pending  PUT /approve|/reject
└──────────────────────────┘
```

**Test items (versioned source of truth):**

- `mobile/lib/screens/hazard_detection_screen.dart`, `mobile/lib/services/{hazard_api_service,ai_api_service,location_service}.dart`, `mobile/lib/models/hazard_report_model.dart`
- `backend/SRMS.API/Controllers/{HazardsController,AiController}.cs`, `backend/SRMS.API/Services/{AiVisionService,AiAnalystService}.cs`, `backend/SRMS.API/Models/RoadHazardReport.cs`, `backend/SRMS.API/Data/AppDbContext.cs`
- `web/src/components/HazardMap.jsx`, `web/src/pages/PendingApprovalsView.jsx`, `web/src/components/AssignWorkerModal.jsx`

---

## 4. Test Approach & Levels

A **test pyramid** anchored on cheap, deterministic unit tests, with a thin layer of integration/E2E on top.

| Level | Target | Tooling | Runs in |
|---|---|---|---|
| **Unit** | Severity mapping, JSON serialisation, model parsing, state‑transition guards | xUnit + Moq · flutter_test + mocktail | CI `backend`, `mobile` |
| **Component / widget** | `HazardDetectionScreen` lifecycle, `HazardMap` rendering, permission denial UI | flutter_test (widget) · Vitest + RTL | CI `mobile`, `web` |
| **Integration / API** | Full MVC pipeline via in‑process `TestServer`, model validation, JWT/RBAC, real Postgres | xUnit + `WebApplicationFactory`/`TestServer` + EF Core/Npgsql | CI `backend` |
| **End‑to‑end** | mobile report → API → Postgres → AI triage → dashboard map | Postman + **Newman** | CI `e2e` |
| **Performance** | Concurrent hazard ingestion | **k6** | CI `load` |
| **Security** | Auth/RBAC, injection, endpoint scanning | Newman security folder + **OWASP ZAP** | CI `security-zap` (manual dispatch) |

### 4.1 Tooling mapped to subsystem layer

| Layer | Primary tools | Existing suites | New/template files (this plan) |
|---|---|---|---|
| Flutter mobile | `flutter_test`, `mocktail`, `integration_test` | `mobile/test/hazard_detection_test.dart` | `mobile/test/hazard_permission_test.dart`, `mobile/integration_test/hazard_permission_test.dart` |
| Backend / API | **xUnit**, **Moq**, `Microsoft.AspNetCore.Mvc.Testing` (TestServer), JWT | `HazardDetectionTests.cs`, `HazardPersistenceTests.cs`, `HazardsApiIntegrationTests.cs` | `AiTriageTests.cs` |
| Database | **EF Core / Npgsql**, real PostgreSQL, `HazardDatabaseFixture` | `HazardPersistenceTests.cs`, `HazardsApiIntegrationTests.cs` | optional Testcontainers template (roadmap) |
| React admin | **Vitest + React Testing Library** | `web/src/test/HazardMap.test.jsx` | roadmap: Playwright E2E |
| Non‑functional | **k6**, **OWASP ZAP** | `tests/k6/hazard-report-load.js`, CI `security-zap` | staged k6 variant (in Test Case doc) |
| AI subsystem | xUnit (in‑process `AiVisionService`/`AiAnalystService`) | — | `AiTriageTests.cs` |

> **Why `mocktail` and not `mockito`:** the mobile project deliberately avoids code‑generated mocks
> (`build_runner`/`mockito`); `mocktail ^1.0.4` is the single mocking library and needs no generated files.
> Hardware and network are replaced through **constructor‑injected providers** already present on
> `HazardDetectionScreen` (`positionProvider`, `positionStreamProvider`, `accelerometerStreamFactory`,
> `reportSender`).

---

## 5. Test Categories

- **Normal / happy path** — a valid report with GPS and a spike produces one persisted, correctly scored hazard.
- **Boundary / edge** — spike exactly at mapping cut‑offs (11.5 client, 18/14/10/7 server), GPS at
  `±90/±180`, `(0,0)` null island, second spike inside the 5 s cooldown, empty hazard list.
- **Invalid / negative** — out‑of‑range coordinates, missing GPS fix, unknown hazard id, re‑approving an
  approved hazard, non‑officer and unauthenticated approval.
- **Permission / resilience** — location denied, denied‑forever, service disabled, permission revoked
  mid‑monitoring; network failure/timeout on report POST.
- **Security** — 401 (no token) vs 403 (wrong role) vs 400 (bad input); SQL injection in `hazardType`;
  prompt‑injection resistance on `/api/ai/chat`.
- **Performance** — 100 concurrent POST `/report` (p95 < 300 ms, failures < 1 %); 50 VU mixed API load (p95 < 500 ms).
- **AI behaviour** — category ∈ {POTHOLE, ROAD_CRACK, DEBRIS, FLOODING, SURFACE_DAMAGE}, confidence in
  `[0.72, 0.99]`, determinism for identical input, spike‑based confidence boost, and
  `isAutoVerified ⇔ confidence ≥ 0.75`.

---

## 6. Test Environment & Data

| Item | Value |
|---|---|
| Runtime | .NET 8 · PostgreSQL 16 · Node 22 · Flutter (SDK ^3.13.1) |
| API base URL (local) | `http://localhost:5017` (mobile emulator override `http://10.0.2.2:5017/api`) |
| Test database | **`srms_test`** — never the production `srms_db` |
| DB connection | `TEST_POSTGRES_CONNECTION` env var (or the shared ASP.NET user secret) |
| Auth fixture | Seeded officer `officer / officer123`; JWTs minted by `TokenFactory` (role `MUNICIPAL_OFFICER`) |
| Test data | Synthetic Colombo‑bbox coordinates (`6.8–7.0`, `79.8–80.0`); spike values across all severity bands |
| CI | GitHub Actions `.github/workflows/ci.yml` — jobs `backend`, `web`, `mobile`, `ai-service`, `e2e`, `load`, `security-zap` |

---

## 7. Non‑Functional Testing (mandatory)

### 7.1 Performance / Load — k6

- **Script:** `tests/k6/hazard-report-load.js` (constant 100 VUs, 30 s) and `tests/k6/integrated-load.js` (50 VUs, mixed).
- **Thresholds:** `http_req_duration p(95) < 300 ms`, `http_req_failed rate < 0.01` (write); integrated load `p(95) < 500 ms`.
- **Rationale:** the hazard write path is the highest‑volume mutating endpoint during peak commuting traffic;
  it must sustain **100+ simultaneous submissions**.
- **Evidence:** `tests/evidence/k6-hazard-summary.json` (threshold checkmarks).

### 7.2 Security — Newman + OWASP ZAP

- **In‑band checks (Newman security folder):** invalid login → 401; missing JWT on officer endpoints → 401;
  worker‑role JWT on approve → **403**; SQL injection in `hazardType` → non‑5xx; prompt injection on chat → still 200.
- **OWASP ZAP baseline (`zap-baseline.py`)** against the running API: passive scan of `/api/hazards/*` and the
  auth surface for missing security headers, cookie/session issues and information disclosure.
- **Constraint noted:** because there is **no multipart upload endpoint**, ZAP exercises the JSON `report`
  endpoint and the `classify-image` JSON endpoint rather than a file‑upload form.
- **Evidence:** `zap-report.html` artifact (CI job `security-zap`, `workflow_dispatch`).

---

## 8. AI Subsystem Testing

The hazard AI is an in‑process, **deterministic** classifier (`AiVisionService`) plus an analyst
(`AiAnalystService`). Tests treat the contract, not a specific model, as the specification:

| Aspect | What is asserted |
|---|---|
| Schema / range | `detectedCategory` ∈ the five categories; `confidenceScore` ∈ `[0.72, 0.99]`; `analysisSummary` non‑empty |
| Determinism / prompt robustness | The same image payload yields the **same** category & confidence (hash‑seeded) |
| Sensor corroboration | `accelerometerSpike ≥ 18` raises confidence by +0.08 (≤ 0.99); `≥ 14` by +0.04 |
| Auto‑verify boundary | `isAutoVerified == (confidence ≥ 0.75)`; when true and a report id is supplied, the report becomes `APPROVED` + `IsVerified` |
| Audit | A `VISION_CLASSIFY` row is written to `AiWorkflowExecutions` |
| Analyst | RDI is clamped to `[0,100]`; cluster radius = 500 m; advisory band thresholds (70/50/30) |

> The **Green Wave** prompt‑injection / safety suite lives in `ai-service/tests/` (pytest, 54 passed) and is
> covered by another group member; the hazard component reuses the same *prompt‑injection‑resistance* concept
> through a Newman check on `/api/ai/chat`.

---

## 9. Entry, Exit & Suspension Criteria

**Entry criteria**
- Hazard feature code merged and building (`dotnet build`, `flutter analyze`, `npm run build` clean).
- Test DB `srms_test` reachable; migrations apply (`Database.MigrateAsync`).
- Test data/seeded officer available.

**Exit criteria (definition of done for the component)**
- 100 % of the planned hazard test cases executed; **all P1/P2 defects closed**; no open S1/S2.
- All automated suites green: backend (incl. `AiTriageTests`), mobile, web.
- k6 thresholds met (p95 < 300 ms, failures < 1 %); security checks pass; ZAP has no High findings.
- Coverage ≥ 80 % on the hazard services/controllers; evidence artifacts archived under `tests/evidence/`.

**Suspension criteria**
- Test DB unavailable, or a build failure blocks > 100 % of a suite; resume only after the blocking defect is fixed.

---

## 10. Roles & Responsibilities

| Role | Person | Responsibility |
|---|---|---|
| Component owner / test lead | [Your Name] | Hazard test design, execution, defect triage, evidence |
| Backend reviewer | [Teammate] | API code review, JWT/role config |
| Front‑end reviewer | [Teammate] | Dashboard review |
| CI owner | [Teammate] | Pipeline health, secret provisioning |

---

## 11. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Hardware (GPS/camera/accelerometer) can't run in CI | High | High | Injectable providers + mocked streams in widget tests; `integration_test` for a real device |
| R2 | Shared Postgres makes DB suites flaky | Medium | High | Dedicated `srms_test`, shared fixture, parallelization disabled, per‑test row cleanup |
| R3 | AI classifier is deterministic/simulated, not a real model | High | Medium | Test the **contract** (schema/range/threshold), document the limitation honestly |
| R4 | No offline queue → dropped reports when offline | Medium | High | Explicitly tested as a known gap (DEF‑HD‑01 family); roadmap item |
| R5 | ZAP is manual‑dispatch and non‑blocking (`\|\| true`) | Medium | Medium | Run on demand; treat High findings as release‑blocking manually |
| R6 | Flutter integration tests need a device/emulator | Medium | Medium | Keep them optional; the default `flutter test` stays green without them |

---

## 12. Traceability Matrix (component → tool → evidence)

| Requirement | Test category | Suite / case IDs | Tool | Evidence |
|---|---|---|---|---|
| S1 spike detection & cooldown | Boundary / edge | HD‑M‑05…07 | flutter_test + mocktail | `flutter test` log |
| S2 GPS capture | Normal | HD‑M‑01 | flutter_test | `flutter test` log |
| S3 media attach | Normal / edge | HD‑M‑09 (new) | flutter_test | `flutter test` log |
| S4 permissions | Permission | HD‑P‑01…04 | flutter_test / integration_test | device run log |
| S5 map & filtering | Normal / edge | HD‑W‑01…04 | Vitest + RTL | `web-junit.xml` |
| S7 ingestion & severity | Normal / boundary / invalid | HD‑B‑01…03, HD‑B‑10 | xUnit + Moq | `backend-hazards.trx` |
| S8 approval + RBAC | Normal / security | HD‑B‑04…09 | xUnit TestServer + JWT | `backend-hazards.trx` |
| S9 AI triage | Normal / boundary | HD‑AI‑01…06 | xUnit | `backend-hazards.trx` |
| S10 dashboard error state | Failure | HD‑W‑05 | Vitest + RTL | `web-junit.xml` |
| E2E workflow | Workflow | INT‑01…05, INT‑11 (AI) | Newman | `e2e-hazards.html` |
| Performance | Load | PERF‑01…02 | k6 | `k6-hazard-summary.json` |
| Security | Security | SEC‑01…07 | Newman + ZAP | Newman table, `zap-report.html` |

---

## 13. Deliverables & Evidence

| Deliverable | Location |
|---|---|
| This test plan | `tests/qa/SE3110_TEST_PLAN.md` |
| Test cases + runnable templates | `tests/qa/SE3110_TEST_CASES_HAZARD.md` |
| Defect reports | `tests/qa/SE3110_DEFECT_REPORTS.md` |
| Viva guide | `tests/qa/SE3110_VIVA_GUIDE.md` |
| Backend TRX | `tests/evidence/backend-hazards.trx` |
| Web JUnit | `tests/evidence/web-junit.xml` |
| Mobile coverage | `mobile/coverage/lcov.info` |
| E2E HTML | `tests/evidence/e2e-hazards.html` |
| k6 summary | `tests/evidence/k6-hazard-summary.json` |
| ZAP report | `zap-report.html` (CI artifact) |

---

## 14. Milestones (no durations — tracked by deliverable completion)

| # | Milestone | Done when |
|---|---|---|
| M1 | Hazard suites authored & green locally | backend/mobile/web suites pass |
| M2 | Non‑functional executed | k6 thresholds met; ZAP baseline run |
| M3 | E2E workflow passing | Newman reports 0 failures |
| M4 | Defects raised, fixed & re‑tested | §Defect report shows Closed/Verified |
| M5 | Evidence archived | all artifacts present in `tests/evidence/` |
| M6 | CI green | jobs `backend`,`web`,`mobile`,`ai-service`,`e2e`,`load` pass |

---

*End of Test Plan.*
