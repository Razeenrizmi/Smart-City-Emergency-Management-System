# SE3110 / SE3090 Assignment 2 — How to test SRMS

This repo already contains automated tests. Use **your Hazard Detection
suites** for the individual 60 marks, and the **integrated E2E + k6 +
security** suites for the group 40 marks.

Evidence folder (create once):

```bash
mkdir -p tests/evidence
```

Always use a **test** database (`srms_test`), never production `srms_db`.

```bash
export TEST_POSTGRES_CONNECTION="Host=localhost;Port=5432;Database=srms_test;Username=postgres;Password=YOUR_PW"
```

---

# A. Individual — Hazard Detection (you)

Assignment tools: xUnit + Moq, EF/Npgsql, Vitest + RTL, flutter_test + mocktail.

## A1. Backend (xUnit)

From the repo root:

```bash
TEST_POSTGRES_CONNECTION="Host=localhost;Port=5432;Database=srms_test;Username=postgres;Password=YOUR_PW" \
  dotnet test backend/SRMS.API.Tests/SRMS.API.Tests.csproj \
  --filter "FullyQualifiedName~Hazard" \
  --results-directory tests/evidence \
  --logger "console;verbosity=normal" \
  --logger "trx;LogFileName=backend-hazards.trx"
```

| File | Tool | What it proves |
|---|---|---|
| `HazardDetectionTests.cs` | xUnit + **Moq** | Severity mapping (normal + **boundary** 18/14/10/7), `(0,0)` GPS rejected, approve/reject, 404 |
| `HazardsApiIntegrationTests.cs` | xUnit + **TestServer** + JWT | Full HTTP pipeline: report→pending→approve, lat/lng **400**, **401/403**, double-approve 400 |
| `HazardPersistenceTests.cs` | xUnit + **EF Core / Npgsql** | Row round-trip, GPS corners, PENDING→APPROVED→RESOLVED |

**Screenshot:** terminal `Passed!` line + `tests/evidence/backend-hazards.trx`.

Viva talking points: Moq fakes `DbSet` so severity tests never need Postgres; integration tests spin a real MVC pipeline; persistence tests hit PostgreSQL.

## A2. Web (Vitest + React Testing Library)

```bash
cd web
NODE_ENV=test npm test
NODE_ENV=test npx vitest run src/test/HazardMap.test.jsx \
  --reporter=junit --outputFile=../tests/evidence/web-junit.xml
```

File: `web/src/test/HazardMap.test.jsx`

Covers: one marker per hazard, popup text, empty map, **RESOLVED / (0,0) filtered out**, **API error / retry** UI.

Must set `NODE_ENV=test` or RTL fails with `React.act is not a function`.

**Screenshot:** `Tests … passed` + `web-junit.xml`.

## A3. Mobile (flutter_test + mocktail)

```bash
cd mobile
flutter pub get
flutter test --reporter expanded test/hazard_detection_test.dart
flutter test --coverage test/hazard_detection_test.dart
```

File: `mobile/test/hazard_detection_test.dart`

Covers: JSON model, HTTP 200/500/network (mocktail), widget **Start Monitoring**, spike **below vs ≥ 11.5** + cooldown, API failure UI.

**Screenshot:** `All tests passed!` (9 tests) + `mobile/coverage/lcov.info` if you generate it.

---

# B. Group — integrated + non-functional

Required by the brief: **at least one complete integrated workflow**, plus **performance and security** (tools, not manual observation).

## B1. Start the live API (needed for Newman, k6, ZAP)

```bash
dotnet run --project backend/SRMS.API
# http://localhost:5017
```

Seeded officer: `officer` / `officer123`.

## B2. E2E / integration (Postman + Newman)

See `tests/e2e/README.md`.

**Your individual demo (narrow):**

```bash
npx --yes -p newman -p newman-reporter-htmlextra newman run \
  tests/e2e/hazards-workflow.postman_collection.json \
  -e tests/e2e/local.postman_environment.json \
  -r cli,htmlextra --reporter-htmlextra-export tests/evidence/e2e-hazards.html
```

Workflow: login → `POST /hazards/report` (mobile) → officer pending → approve → `GET /hazards/all` (web map).

**Group integrated demo (whole project):**

```bash
npx --yes -p newman -p newman-reporter-htmlextra newman run \
  tests/e2e/srms-integrated.postman_collection.json \
  -e tests/e2e/local.postman_environment.json \
  -r cli,htmlextra --reporter-htmlextra-export tests/evidence/e2e-integrated.html
```

That collection also hits Green Wave (`/api/routes`, create/cancel emergency, **activation blocked** without route/AI), crime-vehicle cameras/hotlist/CCTV/dashboard, junctions (`/api/Intersections`), hazard AI insights/chat, and extra security.

**Screenshot:** Newman table (`failed 0`) + HTML report.

## B3. Performance — k6 load

```bash
k6 run --summary-export=tests/evidence/k6-hazard-summary.json tests/k6/hazard-report-load.js
k6 run --summary-export=tests/evidence/k6-integrated-summary.json tests/k6/integrated-load.js
```

| Script | Scenario | Thresholds |
|---|---|---|
| `hazard-report-load.js` | 100 VUs, 30 s, `POST /api/hazards/report` | **p95 < 300 ms**, errors **< 1%** |
| `integrated-load.js` | 50 VUs, 30 s, mixed report + `/hazards/all` + `/routes` + `/Intersections` + `/health` | **p95 < 500 ms**, errors **< 1%** |

Install: `brew install k6`. **Screenshot:** k6 summary with thresholds `✓`.

## B4. Security

Already in both Newman collections (folder **Security**):

- Invalid login → 401  
- Missing JWT on `/auth/me`, hazard approve, work-orders → 401  
- Worker-role JWT on officer approve → **403** (RBAC)  
- SQLi in `hazardType` → **not 5xx** (parameterized EF)  
- Prompt-injection chat → still 200, no crash  

Optional OWASP ZAP (group extra NFT): GitHub **Actions → CI → Run workflow** (manual). Download `zap-report` artifact.

---

# C. Other members’ component tests (group coverage)

You do **not** need to own these, but they exist and should be in the group test plan:

| Component | Command |
|---|---|
| Emergency Green Wave backend | `dotnet test backend/SRMS.API.Tests --filter FullyQualifiedName~EmergencyGreenWave` |
| Green Wave React | `cd web && NODE_ENV=test npx vitest run src/modules/emergency-green-wave` |
| LangGraph AI service | `cd ai-service && python -m pytest -q` (approval, prompt protection, safety) |
| Other Flutter tests | `cd mobile && flutter test` |

---

# D. CI evidence

Push to GitHub and screenshot green jobs: `backend`, `web`, `mobile`, `ai-service`, `e2e`, `load`.

`security-zap` is **workflow_dispatch** only.

---

# E. What to put in each assignment document

| Document | Fill with |
|---|---|
| Test plan | Scope = SRMS; individual = Hazard Detection (A1–A3); group = B2–B4; tools as named above; env = .NET 8, Postgres 16, Node 22, Flutter, k6 |
| Test cases | IDs in `tests/SE3110_TEST_CASES.md` — copy expected/actual/Pass after you run |
| Defect report | Any real fail you hit, fix, re-run, screenshot before/after. If none: record a **fixed defect** from git (e.g. `(0,0)` GPS rejected so the map does not show Null Island) |
| Execution summary | Counts from each runner + CI |
| Tool evidence | trx, junit, lcov, Newman HTML, k6 JSON, Actions screenshot |

---

# F. Viva (individual 15)

Be ready to:

1. Run `dotnet test --filter FullyQualifiedName~HazardDetectionTests` and explain a **boundary** spike (18.0 → severity 5, 17.9 → 4).  
2. Run Newman hazards collection with the API up.  
3. Change a threshold in a test and show it fail, then revert.  
4. Explain why k6 hits `/api/hazards/report` (the mobile write path under concurrent vehicles).  
5. Explain 401 vs 403 in the security folder.
