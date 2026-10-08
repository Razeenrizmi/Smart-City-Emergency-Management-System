# SE3110 — Test Case Document (with runnable templates)

## Road Hazard Detection Mobile Subsystem — Individual Component

| Field | Value |
|---|---|
| **Owner** | [Your Name] — [Your IT Number] |
| **Companion** | `tests/qa/SE3110_TEST_PLAN.md` |
| **Environment** | API `http://localhost:5017` · Postgres `srms_test` · Flutter SDK ^3.13.1 · Node 22 |
| **Fill-in** | Record **Actual** and **Pass/Fail** after you run each case. |

**How to run everything (repo root):**

```bash
# Backend (xUnit + Moq + TestServer + real Postgres) — includes the AI triage suite
export TEST_POSTGRES_CONNECTION="Host=localhost;Port=5432;Database=srms_test;Username=postgres;Password=YOUR_PW"
dotnet test backend/SRMS.API.Tests/SRMS.API.Tests.csproj \
  --filter "FullyQualifiedName~Hazard|FullyQualifiedName~AiTriage" \
  --results-directory tests/evidence --logger "trx;LogFileName=backend-hazards.trx"

# Mobile (flutter_test + mocktail)
cd mobile && flutter pub get && flutter test --reporter expanded && cd ..

# Web (Vitest + RTL)
cd web && NODE_ENV=test npx vitest run src/test/HazardMap.test.jsx && cd ..

# E2E (Newman) — API must be running
npx --yes -p newman newman run tests/e2e/hazards-workflow.postman_collection.json \
  -e tests/e2e/local.postman_environment.json

# Performance (k6)
k6 run tests/k6/hazard-report-load.js
```

> **Reality notes baked into these cases:** the mobile app uses **`flutter_map`**, not the Google Maps SDK;
> the hazard **AI triage runs inside ASP.NET Core** (`AiVisionService`), not in `ai-service/`; there is **no
> offline queue** and **no multipart upload endpoint**. The cases below test what actually exists and mark
> the gaps as *Known Limitation* rather than pretending otherwise.

---

## 1. Test Case Inventory

### 1.1 Mobile — capture & service (Flutter)

| ID | Feature | Type | Preconditions | Steps / Input | Expected | Actual | P/F |
|---|---|---|---|---|---|---|---|
| HD‑M‑01 | Model JSON round‑trip | Normal | — | `toJson` then `fromJson` | lat/lng/spike/hazardType preserved; `createdAt` omitted when null | | |
| HD‑M‑02 | Report POST 200 | Normal | Mock HTTP client | `postHazardReport` returns 200 `{id:"h1"}` | `{success:true, data.id=="h1"}` | | |
| HD‑M‑03 | Report POST 500 | Failure | Mock client | server returns 500 | `{success:false}`, error contains `500` | | |
| HD‑M‑04 | Report network down | Failure | Mock client | client throws `SocketException` | `{success:false}`, error contains message, no crash | | |
| HD‑M‑05 | Start monitoring | Normal | Screen mounted | tap **Start** (HUD tab) | control flips Start→Stop, status `MONITORING` | | |
| HD‑M‑06 | Spike threshold | Boundary | Monitoring | emit Z=5 then Z=12 | exactly **one** report, `accelerometerZSpike==12` | | |
| HD‑M‑07 | 5 s cooldown | Edge | One report sent | emit second spike (Z=20) within 5 s | still one report | | |
| HD‑M‑08 | Report API failure UI | Failure | Monitoring | sender returns `{success:false,error:"…500"}` | HUD shows `Failed: …`, no crash | | |
| HD‑M‑09 | Manual report w/o spike | Edge | Screen mounted, GPS available | tap force‑report | report posted with `accelerometerZSpike==5.0` | | |
| HD‑M‑10 | Missing photo still reports | Edge | No image attached | trigger a report | report posts; no photo validation blocks it *(current behaviour)* | | |
| HD‑M‑11 | Severity label derivation | Boundary | Z values 5/10/15/19 | read `Severity: n/5` | 1 / 2 / 3 / 5 (client formula) | | |

### 1.2 Mobile — permissions & resilience (Flutter)

| ID | Feature | Type | Preconditions | Steps / Input | Expected | Actual | P/F |
|---|---|---|---|---|---|---|---|
| HD‑P‑01 | Location denied → error state | Permission | position provider throws `denied` | tap **Start** | status shows `Error: …denied…`, no crash | | |
| HD‑P‑02 | Location service disabled | Permission | provider throws `disabled` | tap **Start** | status shows `Error: …disabled…` | | |
| HD‑P‑03 | Denied‑forever | Permission | provider throws `deniedForever` | tap **Start** | error surfaced, app usable | | |
| HD‑P‑04 | Grant after retry | Permission | first throw, then success | tap Start twice | second attempt reaches `MONITORING` | | |
| HD‑P‑05 | Revoked mid‑monitoring *(known limitation)* | Resilience | monitoring active | stream errors after start | documented gap — see DEF‑HD‑01 | | |

### 1.3 Backend — API (xUnit + TestServer)

| ID | Feature | Type | Preconditions | Steps / Input | Expected | Actual | P/F |
|---|---|---|---|---|---|---|---|
| HD‑B‑01 | Severity mapping | Normal | Moq DbContext | POST spike 12.5 | `SeverityScore==3`, 200, row stored | | |
| HD‑B‑02 | Severity boundaries | Boundary | Moq | spike 18.0/17.9/14.0/13.9/10.0/9.9/7.0/6.9 | 5/4/4/3/3/2/2/1 | | |
| HD‑B‑03 | Null‑island rejected | Invalid | Moq | POST lat=0 lng=0 | 400, nothing stored | | |
| HD‑B‑04 | Default pending + unverified | Normal | Moq | POST valid report | `ApprovalStatus=="PENDING"`, `IsVerified==false` | | |
| HD‑B‑05 | Approve | Normal | Pending row | PUT `/approve` as officer | 200, `APPROVED`, `IsVerified==true` | | |
| HD‑B‑06 | Approve twice | Failure | Already APPROVED | PUT `/approve` again | 400 | | |
| HD‑B‑07 | Reject | Normal | Pending row | PUT `/reject` | 200, `REJECTED`, not verified | | |
| HD‑B‑08 | Unknown id | Failure | — | PUT random GUID | 404 | | |
| HD‑B‑09 | Geo range | Invalid | TestServer | lat 95 / lng 190 / lat −91 / lng −181 | 400 each | | |
| HD‑B‑10 | Missing coordinates | Invalid | TestServer | body without lat/lng | 400 | | |
| HD‑B‑11 | Auth | Security | TestServer | approve with **no** JWT | 401 | | |
| HD‑B‑12 | RBAC | Security | Worker JWT | approve | 403 | | |
| HD‑B‑13 | Photo carried as `imageUrl` | Normal | TestServer | POST with `imageUrl` | value round‑trips in `GET /all` | | |
| HD‑B‑14 | Persistence round‑trip | DB | Postgres | insert then re‑read `AsNoTracking` | all fields match | | |
| HD‑B‑15 | Status lifecycle | DB | Postgres | PENDING→APPROVED→RESOLVED | all persisted | | |

### 1.4 Backend — AI triage (xUnit)

| ID | Feature | Type | Preconditions | Steps / Input | Expected | Actual | P/F |
|---|---|---|---|---|---|---|---|
| HD‑AI‑01 | Category schema | Normal | `AiVisionService` (mock DbContext) | classify a base64 payload | category ∈ {POTHOLE, ROAD_CRACK, DEBRIS, FLOODING, SURFACE_DAMAGE} | | |
| HD‑AI‑02 | Confidence range | Boundary | as above | classify | `0.72 ≤ confidence ≤ 0.99` | | |
| HD‑AI‑03 | Determinism | Normal | as above | classify the **same** payload twice | identical category & confidence | | |
| HD‑AI‑04 | Spike boost | Boundary | as above | spike 0 vs 20 | high‑spike confidence ≥ low‑spike confidence (capped 0.99) | | |
| HD‑AI‑05 | Auto‑verify boundary | Boundary | as above | many payloads | `isAutoVerified == (confidence ≥ 0.75)` | | |
| HD‑AI‑06 | Report auto‑approval | Normal | report linked by id | classify with high confidence | report becomes `APPROVED` + `IsVerified`; `VISION_CLASSIFY` audit row written | | |

### 1.5 Web dashboard (Vitest + RTL)

| ID | Feature | Type | Steps | Expected | Actual | P/F |
|---|---|---|---|---|---|---|
| HD‑W‑01 | Markers | Normal | render 2 hazards | 2 markers; correct `data-position` | | |
| HD‑W‑02 | Popup content | Normal | approved pothole | coords, `3/5`, `Approved`, Google deep link | | |
| HD‑W‑03 | Empty map | Edge | `hazards=[]` | map container, 0 markers | | |
| HD‑W‑04 | Filtering | Edge | RESOLVED + `(0,0)` + approved | only the approved marker | | |
| HD‑W‑05 | API error state | Failure | fetch rejects | `Connection Error` + Retry button | | |

### 1.6 Integrated E2E & non‑functional

| ID | Feature | Type | Steps | Expected | Actual | P/F |
|---|---|---|---|---|---|---|
| INT‑01 | Login | Normal | officer / officer123 | 200 + token | | |
| INT‑02 | Hazard E2E | Workflow | report → pending → approve → `/all` | hazard APPROVED & visible on map API | | |
| INT‑03 | AI triage E2E | Workflow | `classify-image` with the report id | category returned; high‑confidence ⇒ APPROVED | | |
| INT‑04 | Public map | Normal | GET `/hazards/all` (no token) | 200 array | | |
| INT‑05 | Green Wave guard | Failure | activate without route/AI | 400 | | |
| SEC‑01 | Bad password | Invalid | wrong password login | 401 | | |
| SEC‑02 | No token approve | Security | PUT approve | 401 | | |
| SEC‑03 | Worker approve | Security | worker JWT | 403 | | |
| SEC‑04 | SQLi in hazardType | Security | `' OR '1'='1` | non‑5xx | | |
| SEC‑05 | Prompt injection | AI safety | chat “ignore previous instructions…” | 200, no crash | | |
| PERF‑01 | Hazard write load | Load | 100 VU · 30 s · POST `/report` | p95 < 300 ms, failures < 1 % | | |
| PERF‑02 | Mixed API load | Load | 50 VU · 30 s | p95 < 500 ms, failures < 1 % | | |

---

## 2. Runnable Templates

### Template 1 — Flutter unit + widget test (model, HTTP service, detection screen)

This is the real, already‑green suite at `mobile/test/hazard_detection_test.dart`. It mocks the **location
provider** and the **HTTP client** through the screen's injection seams (no hardware needed).

```dart
// mobile/test/hazard_detection_test.dart  (excerpt — full file already in the repo)
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:mocktail/mocktail.dart';
import 'package:sensors_plus/sensors_plus.dart';

import 'package:mobile/models/hazard_report_model.dart';
import 'package:mobile/screens/hazard_detection_screen.dart';
import 'package:mobile/services/hazard_api_service.dart';

class MockHttpClient extends Mock implements http.Client {}

Position _fakePosition({double latitude = 6.9271, double longitude = 79.8850}) => Position(
      latitude: latitude, longitude: longitude, timestamp: DateTime.utc(2026, 1, 1),
      accuracy: 5, altitude: 0, altitudeAccuracy: 0, heading: 0, headingAccuracy: 0,
      speed: 0, speedAccuracy: 0,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ── Unit: model JSON ────────────────────────────────────────────────
  group('HazardReportModel', () {
    test('toJson/fromJson round-trip', () {
      final model = HazardReportModel(
        latitude: 6.9271, longitude: 79.8850, accelerometerZSpike: 12.5, hazardType: 'POTHOLE',
        createdAt: DateTime.utc(2026, 1, 2, 3, 4, 5),
      );
      expect(model.toJson()['latitude'], 6.9271);
      expect(model.toJson()['severityScore'], 1);
      expect(HazardReportModel.fromJson(model.toJson()).longitude, 79.8850);
    });
  });

  // ── Unit: HTTP service (mock the client) ────────────────────────────
  group('HazardApiService.postHazardReport', () {
    late MockHttpClient client;
    setUp(() => client = MockHttpClient());
    setUpAll(() => registerFallbackValue(Uri()));

    test('200 → success', () async {
      when(() => client.post(any(), headers: any(named: 'headers'), body: any(named: 'body')))
          .thenAnswer((_) async => http.Response(jsonEncode({'success': true, 'id': 'h1'}), 200));
      final r = await HazardApiService.postHazardReport(
        HazardReportModel(latitude: 6.9, longitude: 79.8, accelerometerZSpike: 12.5), client: client);
      expect(r['success'], isTrue);
    });

    test('500 → failure result (no crash)', () async {
      when(() => client.post(any(), headers: any(named: 'headers'), body: any(named: 'body')))
          .thenAnswer((_) async => http.Response('boom', 500));
      final r = await HazardApiService.postHazardReport(
        HazardReportModel(latitude: 6.9, longitude: 79.8, accelerometerZSpike: 12.5), client: client);
      expect(r['success'], isFalse);
      expect(r['error'], contains('500'));
    });
  });

  // ── Widget: full detection lifecycle, location mocked ───────────────
  group('HazardDetectionScreen', () {
    testWidgets('spike ≥ 11.5 reports once; cooldown suppresses the second', (tester) async {
      final accel = StreamController<AccelerometerEvent>.broadcast();
      addTearDown(accel.close);
      final reports = <HazardReportModel>[];

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() { tester.view.resetPhysicalSize(); tester.view.resetDevicePixelRatio(); });

      await tester.pumpWidget(MaterialApp(
        home: HazardDetectionScreen(
          positionProvider: () async => _fakePosition(),                    // mocked location
          positionStreamProvider: () => const Stream<Position>.empty(),     // no live GPS
          accelerometerStreamFactory: () => accel.stream,                   // injected sensor
          reportSender: (report) async { reports.add(report); return {'success': true, 'data': {'id': 'h1'}}; },
        ),
      ));

      await tester.ensureVisible(find.byKey(const ValueKey('start')));
      await tester.tap(find.byKey(const ValueKey('start')));
      await tester.pump(); await tester.pump();

      accel.add(AccelerometerEvent(1, 1, 5, DateTime.now()));   // below threshold
      await tester.pump();
      expect(reports, isEmpty);

      accel.add(AccelerometerEvent(1, 1, 12, DateTime.now()));  // above threshold
      await tester.pump(); await tester.pump();
      expect(reports.length, 1);
      expect(reports.single.accelerometerZSpike, 12);

      accel.add(AccelerometerEvent(1, 1, 20, DateTime.now()));  // inside cooldown
      await tester.pump(); await tester.pump();
      expect(reports.length, 1);

      await tester.pumpWidget(const SizedBox()); // dispose → cancels streams/timers
    });
  });
}
```

**Tests for the "missing photo / severity" cases (HD‑M‑09…11):** the screen has **no required‑photo rule**
and severity is **derived from the spike**, not chosen by the user. Assert that behaviour (a report posts
with no image; `Severity: n/5` follows the spike) — see `mobile/test/hazard_permission_test.dart` (Template 2).

---

### Template 2 — Flutter permission / resilience test (location denied + manual report)

**New file:** `mobile/test/hazard_permission_test.dart` (no new dependency). Drives the screen with a
location provider that throws exactly what `LocationService` throws, proving graceful degradation.

```dart
// mobile/test/hazard_permission_test.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';

import 'package:mobile/models/hazard_report_model.dart';
import 'package:mobile/screens/hazard_detection_screen.dart';

Position _pos() => Position(
      latitude: 6.9271, longitude: 79.8850, timestamp: DateTime.utc(2026, 1, 1),
      accuracy: 5, altitude: 0, altitudeAccuracy: 0, heading: 0, headingAccuracy: 0,
      speed: 0, speedAccuracy: 0,
    );

Future<void> _pump(
  WidgetTester tester, {
  required Future<Position> Function() positionProvider,
  Future<Map<String, dynamic>> Function(HazardReportModel)? onReport,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() { tester.view.resetPhysicalSize(); tester.view.resetDevicePixelRatio(); });
  await tester.pumpWidget(MaterialApp(
    home: HazardDetectionScreen(
      positionProvider: positionProvider,
      positionStreamProvider: () => const Stream<Position>.empty(),
      accelerometerStreamFactory: () => const Stream<AccelerometerEvent>.empty(),
      reportSender: onReport ?? (_) async => {'success': true, 'data': {'id': 'h1'}},
    ),
  ));
  await tester.tap(find.text('Sensor & AI HUD'));
  await tester.pump();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('HD-P-01: denied permission surfaces an error, app does not crash', (tester) async {
    await _pump(tester,
        positionProvider: () async => throw Exception('Location permissions are denied.'));

    await tester.ensureVisible(find.byKey(const ValueKey('start')));
    await tester.tap(find.byKey(const ValueKey('start')));
    await tester.pump(); await tester.pump();

    expect(find.textContaining('Error:'), findsWidgets);
    expect(find.textContaining('denied'), findsWidgets);
    // still interactive
    expect(find.byKey(const ValueKey('start')), findsOneWidget);
  });

  testWidgets('HD-P-02: location service disabled is reported clearly', (tester) async {
    await _pump(tester,
        positionProvider: () async =>
            throw Exception('Location services are disabled. Please enable them in Settings.'));

    await tester.ensureVisible(find.byKey(const ValueKey('start')));
    await tester.tap(find.byKey(const ValueKey('start')));
    await tester.pump(); await tester.pump();

    expect(find.textContaining('disabled'), findsWidgets);
  });

  testWidgets('HD-M-09: manual report uses a default spike when none detected', (tester) async {
    final sent = <HazardReportModel>[];
    await _pump(tester,
        positionProvider: () async => _pos(),
        onReport: (r) async { sent.add(r); return {'success': true, 'data': {'id': 'h1'}}; });

    await tester.ensureVisible(find.textContaining('Manual Report'));
    await tester.tap(find.textContaining('Manual Report'));
    await tester.pump(); await tester.pump();

    expect(sent, isNotEmpty);
    expect(sent.single.accelerometerZSpike, 5.0);
    expect(sent.single.latitude, 6.9271);
  });
}
```

> The exact "Force Report" button label is defined in `_buildManualReportButton`; if it differs in your
> build, match the `find.textContaining(...)` to the on‑screen caption (the button also has a stable
> widget key you can target instead).

---

### Template 2b — Flutter *integration_test* permission suite (real device/emulator)

This is the deeper permission test that exercises `LocationService` itself by swapping the geolocator
platform. **Harness work required:** add `integration_test` to `mobile/pubspec.yaml` and run on a device.

```yaml
# mobile/pubspec.yaml  (dev_dependencies — add:)
dev_dependencies:
  flutter_test:
    sdk: flutter
  integration_test:
    sdk: flutter
  flutter_lints: ^6.0.0
  mocktail: ^1.0.4
```

```dart
// mobile/integration_test/hazard_permission_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:mobile/services/location_service.dart';

class MockGeolocatorPlatform extends Mock implements GeolocatorPlatform {}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  late MockGeolocatorPlatform platform;

  setUp(() {
    platform = MockGeolocatorPlatform();
    GeolocatorPlatform.instance = platform;
  });

  testWidgets('denied permission makes getCurrentPosition throw', (tester) async {
    when(() => platform.isLocationServiceEnabled()).thenAnswer((_) async => true);
    when(() => platform.checkPermission()).thenAnswer((_) async => LocationPermission.denied);
    when(() => platform.requestPermission()).thenAnswer((_) async => LocationPermission.denied);

    expect(() => LocationService.getCurrentPosition(), throwsA(isA<Exception>()));
  });

  testWidgets('denied-forever permission is reported distinctly', (tester) async {
    when(() => platform.isLocationServiceEnabled()).thenAnswer((_) async => true);
    when(() => platform.checkPermission()).thenAnswer((_) async => LocationPermission.deniedForever);

    expect(
      () => LocationService.getCurrentPosition(),
      throwsA(predicate((e) => e.toString().contains('permanently denied'))),
    );
  });

  testWidgets('disabled location service is reported distinctly', (tester) async {
    when(() => platform.isLocationServiceEnabled()).thenAnswer((_) async => false);

    expect(
      () => LocationService.getCurrentPosition(),
      throwsA(predicate((e) => e.toString().contains('disabled'))),
    );
  });
}
```

Run: `flutter test integration_test/hazard_permission_test.dart` (device/emulator attached).

---

### Template 3 — xUnit API controller test for `POST /api/hazards/report`

Uses the same in‑process `TestServer` + JWT pattern as `HazardsApiIntegrationTests.cs`. Add these cases to
that file (or a new `HazardGeoValidationTests.cs`).

```csharp
// backend/SRMS.API.Tests/HazardsApiIntegrationTests.cs  (additional cases)
[Theory]
[InlineData(6.9271, 79.8850)]   // in range (normal)
[InlineData(90.0, 180.0)]       // max bounds (boundary)
[InlineData(-90.0, -180.0)]     // min bounds (boundary)
public async Task Report_with_in_range_coordinates_is_accepted(double lat, double lng)
{
    var response = await _client.PostAsJsonAsync("/api/hazards/report", new
    {
        latitude = lat, longitude = lng, accelerometerZSpike = 12.5, hazardType = "POTHOLE",
    });
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
}

[Fact]
public async Task Report_carries_the_photo_as_imageUrl()
{
    var response = await _client.PostAsJsonAsync("/api/hazards/report", new
    {
        latitude = 6.9271, longitude = 79.8850, accelerometerZSpike = 12.5,
        hazardType = "POTHOLE", imageUrl = "https://cdn.example/hazard/abc.jpg",
    });
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    var id = doc.RootElement.GetProperty("id").GetGuid();
    _created.Add(id);

    var all = await SendAsync(HttpMethod.Get, "/api/hazards/all", null);
    using var allDoc = JsonDocument.Parse(await all.Content.ReadAsStringAsync());
    var hazard = allDoc.RootElement.GetProperty("data").EnumerateArray()
        .Single(h => h.GetProperty("hazardId").GetGuid() == id);
    Assert.Equal("https://cdn.example/hazard/abc.jpg", hazard.GetProperty("imageUrl").GetString());
}
```

> **Not applicable here:** there is **no multipart/`IFormFile` upload** on the hazard API — the photo is a
> plain `imageUrl` string, and image analysis is the separate JSON `POST /api/ai/classify-image` (Template 5).

---

### Template 4 — k6 load script (100 concurrent hazard submissions)

Existing: `tests/k6/hazard-report-load.js` (constant 100 VUs, 30 s). Run: `k6 run tests/k6/hazard-report-load.js`.

```javascript
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5017';

export const options = {
  scenarios: {
    hazard_reports: { executor: 'constant-vus', vus: 100, duration: '30s' },
  },
  thresholds: {
    http_req_duration: ['p(95)<300'],   // 95th percentile under 300 ms
    http_req_failed: ['rate<0.01'],     // < 1% failures
  },
};

const randomInRange = (min, max) => min + Math.random() * (max - min);

export default function () {
  const payload = JSON.stringify({
    latitude: randomInRange(6.8, 7.0),      // Colombo-ish bbox so every report is plausible
    longitude: randomInRange(79.8, 80.0),
    accelerometerZSpike: randomInRange(7.0, 19.0),
    hazardType: 'POTHOLE',
  });
  const response = http.post(`${BASE_URL}/api/hazards/report`, payload,
    { headers: { 'Content-Type': 'application/json' } });
  check(response, {
    'status is 200': (r) => r.status === 200,
    'report id returned': (r) => { try { return typeof r.json('id') === 'string'; } catch (e) { return false; } },
  });
}
```

**Staged variant** — model a morning‑rush ramp (0 → 150 VUs) to see where the write path saturates:

```javascript
export const options = {
  scenarios: {
    rush_hour: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '20s', target: 150 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.01'] },
};
```

**Image‑carrying load note:** once a photo is attached, the mobile client also calls `POST /api/ai/classify-image`
(up to 15 s). Add that call to the k6 scenario with a **separate, looser threshold** (e.g. `p(95)<1500`) so the
classifier's latency does not fail the ingestion SLO.

---

### Template 5 — Agentic AI hazard‑triage test (`AiVisionService`)

**New file:** `backend/SRMS.API.Tests/AiTriageTests.cs`. This is the real AI triage — an in‑process,
deterministic classifier behind `AiVisionService`. Runs without a database via the shared Moq factory.

```csharp
// backend/SRMS.API.Tests/AiTriageTests.cs
using Microsoft.Extensions.Logging.Abstractions;
using SRMS.API.Models;
using SRMS.API.Services;
using SRMS.API.Tests.Support;
using Xunit;

namespace SRMS.API.Tests;

/// <summary>
/// Contract tests for the hazard AI triage pipeline (AiVisionService):
/// classification schema, confidence bounds, determinism, sensor corroboration
/// and the 0.75 auto-verification boundary. No external model is required.
/// </summary>
public sealed class AiTriageTests
{
    private static readonly string[] Categories =
        ["POTHOLE", "ROAD_CRACK", "DEBRIS", "FLOODING", "SURFACE_DAMAGE"];

    private static AiVisionService Service(out List<HazardAiWorkflowExecution> audit)
    {
        var (ctx, _, executions) = MockDbContextFactory.CreateWithAi();
        audit = executions;
        return new AiVisionService(ctx.Object, NullLogger<AiVisionService>.Instance);
    }

    [Fact]
    public async Task Classify_returns_category_within_the_supported_set()
    {
        var svc = Service(out _);
        var result = await svc.ClassifyImageAsync("pothole-image-payload", null, 12.5);
        Assert.Contains(result.DetectedCategory, Categories);
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(12.5)]
    [InlineData(20.0)]
    public async Task Confidence_is_bounded(double spike)
    {
        var svc = Service(out _);
        var result = await svc.ClassifyImageAsync("some-image", null, spike);
        Assert.InRange(result.ConfidenceScore, 0.72, 0.99);
    }

    [Fact]
    public async Task Same_image_is_deterministic()
    {
        var svc = Service(out _);
        var a = await svc.ClassifyImageAsync("identical-payload", null, 12.5);
        var b = await svc.ClassifyImageAsync("identical-payload", null, 12.5);
        Assert.Equal(a.DetectedCategory, b.DetectedCategory);
        Assert.Equal(a.ConfidenceScore, b.ConfidenceScore);
    }

    [Fact]
    public async Task AutoVerified_flag_matches_the_0_75_threshold()
    {
        var svc = Service(out _);
        foreach (var payload in new[] { "img-a", "img-b", "img-c", "img-d", "img-e", "img-f" })
        {
            var r = await svc.ClassifyImageAsync(payload, null, 0.0);
            Assert.Equal(r.ConfidenceScore >= 0.75, r.IsAutoVerified);
        }
    }

    [Fact]
    public async Task Spike_boost_raises_confidence_but_never_exceeds_cap()
    {
        var svc = Service(out _);
        var low = await svc.ClassifyImageAsync("same", null, 0.0);
        var high = await svc.ClassifyImageAsync("same", null, 20.0);
        Assert.True(high.ConfidenceScore >= low.ConfidenceScore);
        Assert.True(high.ConfidenceScore <= 0.99);
    }

    [Fact]
    public async Task Vision_classification_is_audited()
    {
        var svc = Service(out var audit);
        await svc.ClassifyImageAsync("audit-me", Guid.NewGuid(), 12.5);
        Assert.Contains(audit, e => e.WorkflowType == "VISION_CLASSIFY");
    }
}
```

> The `Controller`‑level auto‑approval transition (a high‑confidence classification sets
> `ApprovalStatus="APPROVED"` + `IsVerified=true` on the linked report) is covered at the HTTP layer by an
> integration case that posts to `POST /api/ai/classify-image` with a `hazardReportId`, mirroring
> `HazardsApiIntegrationTests`. `MockDbContextFactory.CreateWithAi()` is the small helper added in
> `Support/MockDbContextFactory.cs` so AI tests need no database.

---

### Template 6 — Complete integrated cross‑platform E2E workflow

**New file:** `tests/e2e/hazard-full-e2e.postman_collection.json` — extends the existing
`hazards-workflow.postman_collection.json` with the **AI auto‑triage** step so the full chain is proven:
*Flutter report → ASP.NET API → PostgreSQL → AI triage (`/ai/classify-image`) → React dashboard (`GET /all`)*.

```bash
# API must be running on :5017 (seeded officer officer/officer123)
npx --yes -p newman newman run tests/e2e/hazard-full-e2e.postman_collection.json \
  -e tests/e2e/local.postman_environment.json \
  -r cli,htmlextra --reporter-htmlextra-export tests/evidence/e2e-hazards-full.html
```

The collection’s order and assertions:

| Step | Request | Assertion |
|---|---|---|
| 1 | `POST /api/auth/login` (officer) | 200; stores `token`, `officerId` |
| 2 | `POST /api/hazards/report` (simulated mobile detection) | 200; stores `hazardId`; `severityScore` set |
| 3 | `POST /api/ai/classify-image` `{imageBase64, hazardReportId, accelerometerSpike}` | 200; `data.detectedCategory` non‑empty; `confidenceScore` in [0.72, 0.99] |
| 4 | `GET /api/hazards/pending` (officer) | 200; contains `hazardId` (or already APPROVED if AI auto‑verified) |
| 5 | `PUT /api/hazards/{{hazardId}}/approve` (officer) | 200 **or** 400 “only pending” when AI already approved — either proves the auto‑triage branch |
| 6 | `GET /api/hazards/all` (public) | 200; hazard present with `approvalStatus` ∈ {PENDING, APPROVED}; `aiDetectedCategory` populated |
| 7 | Security: approve with **no token** | 401 |
| 8 | Security: approve with **worker** JWT | 403 |
| 9 | Security: `hazardType = ' OR '1'='1` | non‑5xx |

Key test script from step 3 (AI triage):

```javascript
pm.test('AI triage returns a classification', () => {
  const d = pm.response.json().data;
  pm.expect(d.detectedCategory).to.be.a('string').and.not.empty;
  pm.expect(d.confidenceScore).to.be.within(0.72, 0.99);
  pm.collectionVariables.set('aiCategory', d.detectedCategory);
});
pm.test('auto-verify flag is a boolean', () => {
  pm.expect(pm.response.json().data.isAutoVerified).to.be.a('boolean');
});
```

> **Maps note:** step 6 is the dashboard’s data source. The React map renders these hazards with **Leaflet**
> (`web/src/components/HazardMap.jsx`); the modern equivalent of a Google pin is the severity‑scaled SVG
> `divIcon`, and the popup offers a deep link to Google Maps — so the “Google Maps integration” the brief asks
> for is fulfilled as a *link/tile option*, not the SDK.

---

*End of Test Case document.*
