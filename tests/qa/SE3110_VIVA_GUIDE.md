# SE3110 — Individual Viva Preparation & Defense Guide

## Road Hazard Detection Mobile Subsystem (individual component — 60 %)

| Field | Value |
|---|---|
| **Owner** | [Your Name] — [Your IT Number] |
| **Companion docs** | `SE3110_TEST_PLAN.md`, `SE3110_TEST_CASES_HAZARD.md`, `SE3110_DEFECT_REPORTS.md` |
| **Format** | Live demo + Q&A on your component |

> **Golden rule:** every claim you make must be **runnable on demand**. You are graded on whether you can
> *show* the test, *read* the result, and *explain* the decision — not on the slides.

---

## 1. The 60‑second pitch (memorise this)

> "I built the **Road Hazard Detection** subsystem. The Flutter app samples the accelerometer and detects a
> road impact when the three‑axis spike exceeds **11.5 m/s²** — just above the ~9.8 m/s² gravity baseline —
> with a **5‑second cooldown** so one pothole makes one report. Each report attaches the **freshest GPS fix**
> from a continuous position stream plus an optional photo, and posts to `POST /api/hazards/report`. The
> ASP.NET Core API validates the coordinates, computes a **1–5 severity score** from the spike, and stores the
> report in PostgreSQL as `PENDING`. An officer approves or rejects it in the React dashboard
> (`PUT /api/hazards/{id}/approve`), and an **AI vision service** classifies the photo with a **0.75
> auto‑verify threshold** so only high‑confidence detections skip human review. I test the whole flow:
> **xUnit + Moq** for the API, **flutter_test + mocktail** for the app, **Vitest + RTL** for the dashboard,
> **Newman** for end‑to‑end, **k6** for load, and **OWASP ZAP** for security."

Say it in 60 seconds, then let the demo prove it.

---

## 2. Live demo runbook (in order — rehearse this)

**Before you start:** API running (`dotnet run --project backend/SRMS.API`), Postgres up, `srms_test` reachable,
emulator running. Have two terminal panes and the dashboard open in a browser.

| # | Do this | Say this |
|---|---|---|
| 1 | `git status` / show the repo map | "These are the hazard files I own." |
| 2 | **Mobile:** `cd mobile && flutter test test/hazard_detection_test.dart` (+ `test/hazard_permission_test.dart`) | "9 + N tests: model JSON, HTTP service, and the full detection lifecycle with location mocked." |
| 3 | **Backend:** `dotnet test backend/SRMS.API.Tests/SRMS.API.Tests.csproj --filter "FullyQualifiedName~Hazard\|FullyQualifiedName~AiTriage"` | "41 hazard tests plus my AI triage suite — unit (Moq), API integration (TestServer), persistence (real Postgres)." |
| 4 | **Web:** `cd web && NODE_ENV=test npx vitest run src/test/HazardMap.test.jsx` | "5 component tests: markers, popup formatting, filtering, and the API‑error state." |
| 5 | **E2E:** `npx newman run tests/e2e/hazards-workflow.postman_collection.json -e tests/e2e/local.postman_environment.json` | "The workflow: report → pending → approve → public map, plus 401/403/SQLi checks." |
| 6 | **Load:** `k6 run tests/k6/hazard-report-load.js` | "100 concurrent reporters, p95 under 300 ms, failures under 1 %." |
| 7 | **Live app:** trigger a manual report in the emulator, then refresh the dashboard map | "Here's a real hazard appearing on the officer map." |
| 8 | Show `tests/evidence/*` | "TRX, JUnit, k6 JSON, Newman HTML — the evidence for the report." |

**Have ready to show (screenshots/artifacts):** `backend-hazards.trx`, `web-junit.xml`, k6 summary, Newman HTML,
`zap-report.html`, and the two defect before/after images.

---

## 3. Q&A bank (with high‑scoring answers)

### A. Flutter testing

**Q: How do you test code that depends on GPS, the camera and the accelerometer?**
A: I test against the screen's **constructor‑injected providers** — `positionProvider`, `positionStreamProvider`,
`accelerometerStreamFactory`, `reportSender`. In tests I pass a fake `Position`, a manually fed
`StreamController<AccelerometerEvent>`, and a stub sender, so the whole detection lifecycle runs with **no
hardware**. That's why the screen was designed with those seams.

**Q: Why `mocktail` and not `mockito`?**
A: `mocktail` needs **no code generation** (`build_runner`), so tests run directly in CI with no build step.
It's the only mocking library in the project by design.

**Q: Show me a failing assertion and fix it.**
A: (Deliberately) change the spike in the test to `5` while the assertion expects one report — it fails with
`Expected: length 1, Actual: length 0` because the value is below the **11.5** threshold. Change it back to
`12` and it passes. This proves the threshold is actually exercised.

**Q: What exactly does the "start monitoring" test prove?**
A: That tapping Start performs a one‑shot fix, flips the control from key `'start'` to `'stop'`, and reaches
`MONITORING` — i.e. the state machine wiring, not just the button label.

**Q: How do you prove the cooldown works?**
A: Feed a spike **above** the threshold → exactly one report; feed a **second** spike within 5 s → still one
report. That's HD‑M‑07.

**Q: You don't have a required‑photo rule — isn't that a bug?**
A: It's a deliberate design choice: the photo is **optional**; a photo‑less report still posts and stays
`PENDING` for an officer. I test *that* behaviour rather than inventing a validation the product doesn't have.

### B. Backend / API testing

**Q: Why do you have three backend test styles?**
A: Different risks: **Moq unit tests** prove the severity mapping and state guards fast and without a DB;
**TestServer integration tests** prove the real HTTP pipeline (model validation, JWT, RBAC); **persistence
tests** prove the PostgreSQL round‑trip and lifecycle. The pyramid keeps the fast tests numerous.

**Q: What are your severity boundary values?**
A: Server mapping is `≥18→5, ≥14→4, ≥10→3, ≥7→2, else 1`, tested at the exact cut‑offs and just below
(18.0/17.9, 14.0/13.9, 10.0/9.9, 7.0/6.9). The **client** spike‑detection threshold is separate: **11.5**.

**Q: Explain 401 vs 403 in your security tests.**
A: **401** = not authenticated (no/invalid JWT). **403** = authenticated but the role isn't allowed. I mint a
valid JWT with role `MUNICIPAL_WORKER` via `TokenFactory` and assert **403** on approve, and no token asserts **401**.

**Q: Why a real Postgres and not an in‑memory provider?**
A: In‑memory providers don't enforce relational/column semantics like PostgreSQL, so they can't validate the
actual schema or migrations. I use a **dedicated `srms_test` DB**, a shared fixture, migration once, and
**disabled parallelization** with per‑test cleanup — plus an optional Testcontainers template if we ever want
fully‑disposable DBs.

**Q: Why is `(0,0)` rejected at the controller but allowed in a persistence test?**
A: Because `(0,0)` is a **valid coordinate** at the data layer (a persistence test proves it round‑trips), but
in this app it means "no GPS fix" (emulators send it pre‑fix), so the **API boundary** rejects it. Different
layers, different rules — both are tested.

### C. AI triage

**Q: Where is the AI? Isn't it a separate service?**
A: For hazards, the AI is **in‑process in ASP.NET Core**: `AiVisionService` (classification + confidence) and
`AiAnalystService` (Road Danger Index, 500 m clustering, copilot). The separate Python `ai-service/` is the
**Green Wave** signal agent — a different component. I test the hazard AI contract directly.

**Q: How do you test an AI you can't control?**
A: I test the **contract**, not a model: category ∈ the five supported values, confidence in `[0.72, 0.99]`,
**determinism** for identical input, spike‑based confidence boost, and `isAutoVerified == (confidence ≥ 0.75)`.
That's what the product actually depends on.

**Q: Is the classifier a real ML model?**
A: No — I document it honestly. It's a deterministic simulation behind a service interface so the system is
fully functional without an external model and swappable later. The tests pin the *behaviour*, and DEF‑HD‑03
shows I found and fixed a safety issue it caused (auto‑approving a low‑severity critical blockage).

### D. k6 & ZAP

**Q: Why does k6 hit `/api/hazards/report`?**
A: It's the highest‑volume **mutating** endpoint — every car that hits a pothole writes one row during the
commute peak. So 100 concurrent VUs writing is the realistic worst case, and I assert **p95 < 300 ms** and
**failures < 1 %**.

**Q: What does ZAP actually prove here, and what are its limits?**
A: `zap-baseline.py` runs a **passive** scan for missing security headers, cookie flags and information
disclosure on the running API. It's a baseline, not a full pentest; it runs on manual dispatch and is
non‑blocking, so I treat High findings as release‑blocking manually. It also can't scan a file‑upload form
because **there isn't one** — images go as base64 JSON.

### E. Cross‑cutting

**Q: What's your exit criteria?**
A: All hazard suites green, no open S1/S2, k6 thresholds met, no High ZAP findings, and ≥80 % coverage on the
hazard controllers/services — evidence archived under `tests/evidence/`.

**Q: What would you do differently?**
A: Add an **offline queue** with retry (currently a dropped report is lost), move image classification to a
real CV model, and add Playwright for true browser E2E of the dashboard.

---

## 4. Defending the brief‑vs‑code gaps (rehearse these!)

The assignment brief may describe features that differ from what's implemented. Answer **confidently and
honestly** — "here's what the code actually does, and here's the reasoning" beats pretending.

| If asked… | Say… |
|---|---|
| "Where is your **Google Maps** integration?" | "The mobile app uses **`flutter_map`** with OSM tiles and the dashboard uses **Leaflet**; Google Maps appears as an optional **tile provider** on the web map plus a **deep link** in each hazard popup. I chose a tile‑agnostic library so we're not locked to a paid SDK key. The testable behaviour — markers, severity icons, popups, filtering — is identical and is covered by 5 component tests." |
| "Where is the **AI service** (`ai-service/`)?" | "`ai-service/` is the **Green Wave** signal agent. Hazard AI triage is deliberately **in‑process** in `AiVisionService`/`AiAnalystService`, reachable at `/api/ai/classify-image` and `/api/ai/insights`. I test that contract directly." |
| "Show me your **offline queue**." | "There isn't one yet — that's an honest, documented limitation (DEF‑HD‑01 family / roadmap). Today a failed POST returns `{success:false}` and the UI shows an error; the report is not queued. I scoped it out to keep the submission runnable, and I've written the roadmap for it." |
| "Show me the **file‑upload** security test." | "Hazard photos are a nullable `imageUrl` string, and analysis is a separate base64 JSON call — there's no multipart endpoint, so ZAP targets the JSON endpoints and auth. Testing a form that doesn't exist would be dishonest." |
| "Why **Testcontainers**? I don't see it." | "We use a real Postgres via `TEST_POSTGRES_CONNECTION` with a shared fixture and disabled parallelization because it matches CI exactly. I included a Testcontainers **template** for fully‑disposable DBs but kept the delivered suite aligned with the real pipeline." |

---

## 5. Mapping to the marking scheme

| Criterion | What proves it |
|---|---|
| Component understanding | The 60‑second pitch + architecture diagram in the Test Plan §3 |
| Test design (normal / boundary / invalid) | `SE3110_TEST_CASES_HAZARD.md` inventory: HD‑M/B/AI/W/P/INT/SEC/PERF |
| Automation & tooling | xUnit/Moq/TestServer, flutter_test/mocktail, Vitest/RTL, Newman, k6, ZAP |
| Non‑functional (mandatory) | k6 thresholds + Newman security folder + ZAP baseline |
| E2E integration | INT‑01…05 + `hazard-full-e2e` collection (mobile→API→DB→AI→dashboard) |
| Defect management | 3 closed defects with root cause + retest evidence |
| Evidence & repeatability | `tests/evidence/*` + green CI jobs |

---

## 6. Rapid‑fire follow‑ups (know the one‑line answer)

- **What is `MockDbContextFactory`?** A Moq helper that fakes `AppDbContext` so controller/AI logic is unit‑tested without a DB.
- **Why does the cooldown exist?** Debouncing — one bump must not create a burst of duplicate reports.
- **What does `_isMonitoring` gate?** Whether a failed report returns to `monitoring` or `error`.
- **Which HTTP client does the hazard path use?** `package:http` directly (not the shared `ApiClient`).
- **What's the auto‑verify threshold?** `0.75`, and it sets `isVerified` + `status=APPROVED` on the linked report.
- **What's the map filter?** Drops `RESOLVED` hazards and `(0,0)` coordinates.
- **How long is the report POST timeout?** 5 s (client), so a dead network fails fast rather than hanging the UI.
- **What role may approve?** `MUNICIPAL_OFFICER` only.

---

*End of Viva Guide.*
