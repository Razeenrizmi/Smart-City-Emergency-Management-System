# SE3110 QA Artifacts — Road Hazard Detection

Four deliverables for the individual **Road Hazard Detection** component (60 %), plus the runnable
test files they reference. Everything is grounded in the actual codebase — see the *reality notes*
below for the places where the brief and the implementation differ.

| Document | Covers |
|---|---|
| [`SE3110_TEST_PLAN.md`](./SE3110_TEST_PLAN.md) | Scope, tool‑mapped test approach, environments, non‑functional (k6 + ZAP), AI testing, risks, traceability |
| [`SE3110_TEST_CASES_HAZARD.md`](./SE3110_TEST_CASES_HAZARD.md) | Case inventory + **6 runnable templates** (Flutter unit/widget, permission, xUnit API, k6, AI triage, E2E) |
| [`SE3110_DEFECT_REPORTS.md`](./SE3110_DEFECT_REPORTS.md) | Reusable defect template + 3 worked, closed defects |
| [`SE3110_VIVA_GUIDE.md`](./SE3110_VIVA_GUIDE.md) | 60‑second pitch, demo runbook, Q&A bank, how to defend the brief‑vs‑code gaps |

## Runnable test files added alongside these docs

| File | Purpose | Needs |
|---|---|---|
| `backend/SRMS.API.Tests/AiTriageTests.cs` | Hazards AI triage contract tests (`AiVisionService`) | `dotnet test` |
| `backend/SRMS.API.Tests/Support/MockDbContextFactory.cs` | Added `CreateWithAi()` so AI tests run with no DB | — |
| `mobile/test/hazard_permission_test.dart` | Location‑denied UI + manual‑report widget tests | `flutter test` |
| `mobile/integration_test/hazard_permission_test.dart` | Real permission handling via geolocator mock | device/emulator + `integration_test` (added to `pubspec.yaml`) |
| `tests/e2e/hazard-full-e2e.postman_collection.json` | Full E2E incl. AI auto‑triage step | Newman + running API |

## Run everything

```bash
# Backend (hazard + AI triage) — needs a test Postgres
export TEST_POSTGRES_CONNECTION="Host=localhost;Port=5432;Database=srms_test;Username=postgres;Password=YOUR_PW"
dotnet test backend/SRMS.API.Tests/SRMS.API.Tests.csproj \
  --filter "FullyQualifiedName~Hazard|FullyQualifiedName~AiTriage" \
  --results-directory tests/evidence --logger "trx;LogFileName=backend-hazards.trx"

# Mobile
cd mobile && flutter pub get && flutter test && cd ..

# Web
cd web && NODE_ENV=test npx vitest run src/test/HazardMap.test.jsx && cd ..

# E2E (API running on :5017)
npx --yes -p newman newman run tests/e2e/hazard-full-e2e.postman_collection.json \
  -e tests/e2e/local.postman_environment.json

# Performance
k6 run tests/k6/hazard-report-load.js
```

## Reality notes (brief vs. code — defended in the Viva Guide)

- **Maps:** mobile = `flutter_map`; dashboard = Leaflet. Google Maps is an optional tile provider / deep link, not the SDK.
- **AI triage:** lives in **ASP.NET Core** (`AiVisionService` / `AiAnalystService`), not the Python `ai-service/` (that is the Green Wave agent).
- **Offline queue:** not implemented — a failed report returns `{success:false}` (documented limitation).
- **Image upload:** no multipart endpoint — photos are an `imageUrl` string; classification is a base64 JSON call.
- **DB tests:** real PostgreSQL (`srms_test`) + shared fixture; Testcontainers appears only as an optional template.

Existing docs (`tests/README.md`, `tests/SE3110_TEST_CASES.md`, `HAZARD_DETECTION_CONTRIBUTION.md`) are left unchanged.
