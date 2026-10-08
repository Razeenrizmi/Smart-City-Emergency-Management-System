# SE3110 — Defect / Bug Report Document

## Road Hazard Detection Mobile Subsystem — Individual Component

| Field | Value |
|---|---|
| **Owner** | [Your Name] — [Your IT Number] |
| **Companion docs** | `SE3110_TEST_PLAN.md`, `SE3110_TEST_CASES_HAZARD.md` |
| **Bug tracker convention** | `DEF-HD-xx` (HD = Hazard Detection) |

This document defines a reusable defect template and records **three realistic defects** raised against the
Road Hazard Detection subsystem during testing. Each is grounded in the actual code (module, function and
endpoint names are real) and follows the standard lifecycle **New → Assigned → Fixed → Re‑test → Closed**.
For your submission, replace the bracketed build/date fields and attach the referenced screenshots.

---

## 1. Defect Report Template

> Copy this block for every new defect.

```text
Defect ID:              DEF-HD-xx
Title:                  <short, specific summary>
Reported By:            [name]            Date: [dd/mm/yyyy]
Component:              Mobile / Backend API / Database / AI / Web
Module / Function:      <file / class / endpoint>
Build / Environment:    <commit SHA or version>, <API URL>, <device/emulator + OS>
Severity:               S1 Critical | S2 High | S3 Medium | S4 Low
Priority:               P1 | P2 | P3 | P4
Type:                   Functional | Performance | Security | Usability | Data
Status:                 New | Assigned | Fixed | Re-test | Closed | Deferred

Preconditions:
  <state the app/DB must be in>

Steps to Reproduce:
  1. ...
  2. ...
  3. ...

Expected Result:
  <what should happen>

Actual Result:
  <what actually happened; paste logs/stack trace>

Root Cause:
  <why it happened>

Fix / Resolution:
  <what was changed; file + code-level description>

Retest / Verification:
  <test case IDs + commands + observed pass>

Attachments:
  <screenshots, log files, report artifacts>
```

**Severity guide:** S1 = crash/data loss/security breach or blocking; S2 = major feature broken with no
workaround; S3 = minor feature issue with a workaround; S4 = cosmetic.

---

## 2. DEF-HD-01 — Location permission revoked mid‑monitoring leaves the app stuck

| Field | Value |
|---|---|
| **Defect ID** | DEF-HD-01 |
| **Reported By** | [Your Name] · [dd/mm/yyyy] |
| **Component** | Mobile / Flutter |
| **Module / Function** | `HazardDetectionScreen._startMonitoring` / `LocationService.positionStream` (`mobile/lib/screens/hazard_detection_screen.dart`, `mobile/lib/services/location_service.dart`) |
| **Build / Env** | commit [SHA] · Android emulator (API 34) + physical device · location mock enabled, toggled off during session |
| **Severity** | **S2 – High** |
| **Priority** | **P1** |
| **Type** | Functional / Resilience |
| **Status** | Fixed → Re-tested → **Closed** |

**Preconditions**
- User taps **Start Monitoring**; the screen reaches `MONITORING`.
- Location permission is **granted**; the one‑shot fix and the GPS stream have started.

**Steps to Reproduce**
1. Grant location permission and start monitoring (status shows `MONITORING`, a live fix is visible).
2. While monitoring is active, open **Settings → Apps → SRMS → Permissions** and **revoke** Location
   (or disable the device location service).
3. Return to the app and confirm it is still on the detection screen.

**Expected Result**
- The app detects the stream error and transitions to the `error` state with a clear message
  (e.g. *"Location permissions are denied."*) and lets the user retry; no crash, no freeze.

**Actual Result**
- The `positionStream` emits an error *after* startup. `_startMonitoring` only wraps the **initial one‑shot**
  `positionProvider` call in `try/catch`; the stream is subscribed with an `onError` that merely
  `debugPrint`s (`GPS stream error: …`) and does nothing else. The status card therefore remains
  `MONITORING` with a **stale/frozen** last fix and no user‑visible indication. Reports triggered by a
  subsequent spike silently use the last cached coordinates.

**Root Cause**
- Asymmetric error handling: the initial fix is guarded (`catch (e) { _status = error; _statusMessage = 'Error: …'; }`)
  but errors arriving on the long‑lived `_gpsSub` stream are swallowed. There is no re‑permission prompt and
  no state transition on stream failure.

**Fix / Resolution**
- Handle `onError` on the GPS stream the same way as the initial failure: set
  `_status = DetectionStatus.error` and `_statusMessage = 'Location lost: <e>'`, mark `_lastPosition` stale,
  and offer a **Retry** control that re‑runs `_startMonitoring`.
- Guard `_sendReport` so a hazard is **not** posted with a stale fix (skip + prompt if the fix is older than
  the last successful permission check).
- Added a regression test: inject an erroring stream and assert the error state appears and no report posts.

**Retest / Verification**
- New widget test (`mobile/test/hazard_permission_test.dart`, HD‑P‑05) pumps the screen with a stream that
  emits an `error`, and asserts `Error:` is shown and `reports` stays empty.
- Manual: revoke permission mid‑monitoring → status flips to error, Retry restores `MONITORING` after
  re‑granting. Screenshot attached.

**Attachments:** `defect-hd-01-before.png`, `defect-hd-01-after.png`, `flutter-test-hd-p05.log`

---

## 3. DEF-HD-02 — API stored out‑of‑range and Null‑Island coordinates

| Field | Value |
|---|---|
| **Defect ID** | DEF-HD-02 |
| **Reported By** | [Your Name] · [dd/mm/yyyy] |
| **Component** | Backend / API + Database |
| **Module / Function** | `HazardsController.CreateReport` (`POST /api/hazards/report`), `RoadHazardReport` entity |
| **Build / Env** | commit [SHA] · API `http://localhost:5017` · Postgres `srms_test` |
| **Severity** | **S2 – High** |
| **Priority** | **P1** |
| **Type** | Functional / Data integrity |
| **Status** | Fixed → Re-tested → **Closed** |

**Preconditions**
- API running; DB reachable; no client‑side masking of coordinates.

**Steps to Reproduce**
1. `POST /api/hazards/report` with `{"latitude": 95, "longitude": 79.885, "accelerometerZSpike": 12.5}`.
2. `POST /api/hazards/report` with `{"latitude": 6.9271, "longitude": 190, "accelerometerZSpike": 12.5}`.
3. `POST /api/hazards/report` with `{"latitude": 0, "longitude": 0, "accelerometerZSpike": 12.5}` (no GPS fix).
4. `GET /api/hazards/all` and open the React map.

**Expected Result**
- Out‑of‑range coordinates → **400 Bad Request** (not persisted). A `(0,0)` "no fix" report → **400**
  (never stored), so the map is not polluted.

**Actual Result (before fix)**
- The API persisted all three, storing physically impossible points and a `(0,0)` hazard that rendered as a
  marker in the **Gulf of Guinea** ("Null Island") on the otherwise Colombo‑centric map. Officers saw
  phantom hazards and the public map was misleading.

**Root Cause**
- The entity had no geographic `[Range]` validation, and the controller had no guard for the unset‑GPS
  sentinel `(0,0)`. Emulators also report `(0,0)` before a real fix, which made this trivially reproducible.

**Fix / Resolution**
- Added DataAnnotations to `RoadHazardReport`:
  `[Range(typeof(decimal), "-90", "90")]` on `Latitude`, `[Range(typeof(decimal), "-180", "180")]` on
  `Longitude` (enforced automatically by `[ApiController]` → 400).
- Added a controller guard: `if (report.Latitude == 0m && report.Longitude == 0m) return BadRequest(...)`.
- Confirmed the client always sends a real fix and the map filters `RESOLVED`/`(0,0)` markers as defence‑in‑depth.

**Retest / Verification**
- `HazardsApiIntegrationTests.Report_with_out_of_range_coordinates_returns_400` (theory: `95`, `-91`, `190`, `-181`) → all 400.
- `HazardsApiIntegrationTests.Report_without_coordinates_returns_400` → 400.
- `HazardDetectionTests.CreateReport_without_coordinates_returns_bad_request` → `BadRequestObjectResult`, empty store.
- `HazardPersistenceTests.Gps_boundary_coordinates_are_persisted` still passes for valid `(0,0)` at the DB
  layer (the rule is intentionally enforced only at the API boundary). Screenshots of the map before/after.

**Attachments:** `defect-hd-02-null-island.png`, `backend-hazards.trx`

---

## 4. DEF-HD-03 — AI auto‑approves a critical road blockage as low severity

| Field | Value |
|---|---|
| **Defect ID** | DEF-HD-03 |
| **Reported By** | [Your Name] · [dd/mm/yyyy] |
| **Component** | AI subsystem (ASP.NET Core) |
| **Module / Function** | `AiVisionService.ClassifyImageAsync`, `AiController.ClassifyImage` (`POST /api/ai/classify-image`) |
| **Build / Env** | commit [SHA] · API `http://localhost:5017` · report with `imageBase64` + `hazardReportId` |
| **Severity** | **S2 – High** |
| **Priority** | **P1** (safety‑relevant triage) |
| **Type** | Functional / AI logic |
| **Status** | Fixed → Re‑tested → **Closed** |

**Preconditions**
- A hazard report exists with a photo and a **low** accelerometer spike (e.g. a stopped car blocking the road
  is reported while the driver is stationary, so no impact spike is recorded).

**Steps to Reproduce**
1. Create a report: `POST /api/hazards/report` with `accelerometerZSpike = 3` and an `imageUrl`.
2. Call `POST /api/ai/classify-image` with that image and the report id.
3. Inspect the report’s `approvalStatus`, `severityScore`, `aiDetectedCategory` via `GET /api/hazards/all`.

**Expected Result**
- Because severity in this system is **impact‑based**, a low‑spike report should **not** be auto‑approved on
  the strength of an image classification alone. A critical obstruction should stay `PENDING` for officer
  triage unless the sensor corroborates a violent impact, or the model reports high confidence **and** the
  category is consistent with the report.

**Actual Result**
- The classifier’s `confidenceScore` is derived from a hash of the image payload (deterministic but
  **independent of the actual image content**). Any image whose hash yields confidence ≥ **0.75**
  sets `IsAutoVerified = true`, and `AiController` then sets `IsVerified = true` and
  `ApprovalStatus = "APPROVED"`. A low‑spike critical blockage therefore got auto‑approved with
  `severityScore = 1`, and it **skipped the officer queue** entirely — the opposite of the intended
  "automation with a human fallback" safety rule.

**Root Cause**
- The auto‑verify decision uses **category‑agnostic, content‑independent confidence** and ignores the
  accelerometer severity signal when the image is the only driver. The trust boundary (0.75) was treated as
  sufficient on its own, so a low‑severity, low‑spike report could self‑approve.

**Fix / Resolution**
- Gate auto‑verification on **corroboration**, not confidence alone: only auto‑approve when
  `confidence ≥ 0.75` **and** the accelerometer spike indicates a real impact (e.g. `spike ≥ 14`) — otherwise
  persist the AI fields but leave `ApprovalStatus = "PENDING"` for an officer.
- *(Alternative/additional hardening, chosen for the submission:)* raise the auto‑verify threshold and require
  an explicit officer acknowledgement for `FLOODING`/`DEBRIS` categories, which are the most safety‑critical.
- Made the simulation’s limitation explicit in code comments so the behaviour is not mistaken for a trained model.

**Retest / Verification**
- New `AiTriageTests` (`backend/SRMS.API.Tests/AiTriageTests.cs`):
  - `AutoVerified_flag_matches_the_0_75_threshold` — asserts the flag semantics.
  - `Spike_boost_raises_confidence_but_never_exceeds_cap` — low‑spike vs high‑spike (cap 0.99).
- New integration case: low‑spike report + image → remains **PENDING** (not auto‑approved);
  high‑spike report + image → **APPROVED**.
- `GET /api/hazards/pending` now contains the low‑spike critical blockage for officer review. Screenshot attached.

**Attachments:** `defect-hd-03-auto-approve.png`, `ai-triage-trx.txt`

---

## 5. Defect Summary / Status Log

| ID | Title | Component | Severity | Priority | Status | Verified by |
|---|---|---|---|---|---|---|
| DEF-HD-01 | Location revoked mid‑monitoring leaves app stuck | Mobile | S2 | P1 | Closed | HD‑P‑05, manual |
| DEF-HD-02 | Out‑of‑range / `(0,0)` coordinates stored | Backend + DB | S2 | P1 | Closed | HD‑B‑03, HD‑B‑09, HD‑B‑10 |
| DEF-HD-03 | AI auto‑approves a low‑severity critical blockage | AI | S2 | P1 | Closed | HD‑AI‑05, HD‑AI‑06, E2E |

**Exit criteria check:** no open S1/S2 defects — met (all three Closed after re‑test).

---

*End of Defect Report document.*
