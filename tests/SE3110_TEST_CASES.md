# SE3110 Test Case Document (copy into Word)

Fill **Actual result** and **Pass/Fail** after you run the commands in `tests/README.md`.
Environment: local API `http://localhost:5017`, Postgres `srms_test`.

## Individual — Hazard Detection backend (xUnit)

| ID | Feature | Type | Preconditions | Steps / input | Expected | Actual | P/F |
|---|---|---|---|---|---|---|---|
| HD-B-01 | Severity mapping | Normal | Moq DbContext | POST report spike 12.5 | Severity 3, 200 | | |
| HD-B-02 | Severity mapping | Boundary | Moq | spike 18.0 / 17.9 / 14.0 / 10.0 / 7.0 / 6.9 | 5 / 4 / 4 / 3 / 2 / 1 | | |
| HD-B-03 | GPS required | Invalid | Moq | lat=0 lng=0 | 400, nothing stored | | |
| HD-B-04 | Approve | Normal | Pending row | PUT approve as officer | APPROVED, IsVerified true | | |
| HD-B-05 | Approve twice | Failure | Already APPROVED | PUT approve | 400 | | |
| HD-B-06 | Unknown id | Failure | — | PUT approve random GUID | 404 | | |
| HD-B-07 | Reject | Normal | Pending row | PUT reject | REJECTED, not verified | | |
| HD-B-08 | Auth | Security | TestServer | PUT approve no JWT | 401 | | |
| HD-B-09 | RBAC | Security | Worker JWT | PUT approve | 403 | | |
| HD-B-10 | GPS range | Invalid | TestServer | lat 95 / lng 190 | 400 | | |
| HD-B-11 | Persistence | DB | Postgres | Insert then reload | Fields match | | |
| HD-B-12 | Status lifecycle | DB | Postgres | PENDING→APPROVED→RESOLVED | All persisted | | |

## Individual — Hazard Detection web (Vitest)

| ID | Feature | Type | Steps | Expected | Actual | P/F |
|---|---|---|---|---|---|---|
| HD-W-01 | Markers | Normal | Render 2 hazards | 2 markers | | |
| HD-W-02 | Popup | Normal | Approved pothole | coords, 3/5, Approved | | |
| HD-W-03 | Empty | Edge | `hazards=[]` | map, 0 markers | | |
| HD-W-04 | Filter | Edge | RESOLVED + (0,0) + approved | 1 marker | | |
| HD-W-05 | API down | Failure | App fetch rejects | Connection Error + Retry | | |

## Individual — Hazard Detection mobile (flutter_test)

| ID | Feature | Type | Steps | Expected | Actual | P/F |
|---|---|---|---|---|---|---|
| HD-M-01 | Model JSON | Normal | toJson / fromJson | lat/lng/spike round-trip | | |
| HD-M-02 | HTTP 200 | Normal | mock 200 | success true | | |
| HD-M-03 | HTTP 500 | Failure | mock 500 | success false | | |
| HD-M-04 | Network | Failure | client throws | failure result, no crash | | |
| HD-M-05 | Start monitoring | Normal | tap Start | Stop + MONITORING | | |
| HD-M-06 | Spike threshold | Boundary | Z=5 then Z=12 | one report, spike 12 | | |
| HD-M-07 | Cooldown | Edge | second spike in 5 s | still one report | | |
| HD-M-08 | Report API fail | Failure | sender returns error | Failed: … on HUD | | |

## Group — integrated E2E (Newman)

| ID | Feature | Type | Steps | Expected | Actual | P/F |
|---|---|---|---|---|---|---|
| INT-01 | Health | Normal | GET /health | 200 | | |
| INT-02 | Login | Normal | officer / officer123 | 200 + JWT | | |
| INT-03 | Hazard E2E | Workflow | report → pending → approve → /all | hazard APPROVED on map API | | |
| INT-04 | Workers | Normal | GET /api/workers + JWT | 200 array | | |
| INT-05 | Green Wave routes | Normal | GET /api/routes | 200 array | | |
| INT-06 | Create emergency | Normal | POST ambulance session | 200 ACTIVE | | |
| INT-07 | Green Wave guard | Failure | activate without route/AI | 400 | | |
| INT-08 | Crime cameras | Normal | GET /api/crime-vehicle/cameras | 200 | | |
| INT-09 | Junctions | Normal | GET /api/Intersections | 200 | | |
| INT-10 | AI insights | Normal | GET /api/ai/insights | 200 + RDI number | | |

## Group — security (Newman)

| ID | Feature | Type | Steps | Expected | Actual | P/F |
|---|---|---|---|---|---|---|
| SEC-01 | Bad password | Invalid | login wrong password | 401 | | |
| SEC-02 | No token /me | Security | GET /api/auth/me | 401 | | |
| SEC-03 | No token approve | Security | PUT approve | 401 | | |
| SEC-04 | Worker approve | Security | worker JWT | 403 | | |
| SEC-05 | Work orders | Security | GET /api/workorders no token | 401 | | |
| SEC-06 | SQLi | Security | hazardType `' OR '1'='1` | status < 500 | | |
| SEC-07 | Prompt injection | AI safety | chat “ignore previous instructions…” | 200, still a message | | |

## Group — performance (k6)

| ID | Feature | Type | Steps | Expected | Actual | P/F |
|---|---|---|---|---|---|---|
| PERF-01 | Hazard write load | Load | 100 VU, 30 s, POST /hazards/report | p95 < 300 ms, fail < 1% | | |
| PERF-02 | Mixed API load | Load | 50 VU, 30 s, report + reads | p95 < 500 ms, fail < 1% | | |
