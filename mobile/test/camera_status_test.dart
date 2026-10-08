import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:mobile/api/srms_api.dart';
import 'package:mobile/congestion.dart';
import 'package:mobile/models/camera_status.dart';
import 'package:mobile/models/intersection_summary.dart';
import 'package:mobile/screens/camera_status_screen.dart';

// Per-Road AI Signal Planning & Camera Telemetry — mobile (traffic
// inspector) tests. SrmsApi uses package:http's top-level functions, so
// http.runWithClient swaps in a MockClient that plays the SRMS.API backend.

http.Response _ok(Object data) => http.Response(
      jsonEncode({'success': true, 'message': 'Success', 'data': data}),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

http.Response _fail(int status, String message) => http.Response(
      jsonEncode({'success': false, 'message': message, 'data': null}),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Map<String, dynamic> _junction(String id, String name, String? level, {int? vehicles, double? density}) => {
      'id': id,
      'name': name,
      'laneCount': 4,
      'latitude': 6.9,
      'longitude': 79.8,
      'totalVehicleCount': level == null ? null : vehicles ?? 10,
      'averageLaneDensityPercent': level == null ? null : density ?? 40,
      'congestionLevel': level,
      'lastUpdated': level == null ? null : '2026-10-08T04:30:00Z',
    };

// Pumps the screen inside a zone where every http call goes to [handler],
// then lets the first (async) load finish.
Future<void> _pumpScreen(WidgetTester tester, MockClientHandler handler) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await http.runWithClient(() async {
    await tester.pumpWidget(const MaterialApp(home: CameraStatusScreen()));
    await tester.pump();
    await tester.pump();
  }, () => MockClient(handler));
}

void main() {
  group('Camera Telemetry — models & congestion rules', () {
    // ST-FL01
    test('ST-FL01 IntersectionSummary parses a reporting junction and a silent one', () {
      final busy = IntersectionSummary.fromJson(_junction('j1', 'Town Hall', 'HIGH', vehicles: 42, density: 70));
      final silent = IntersectionSummary.fromJson(_junction('j2', 'Borella', null));

      expect(busy.name, 'Town Hall');
      expect(busy.totalVehicleCount, 42);
      expect(busy.averageLaneDensityPercent, 70.0);
      expect(busy.congestionLevel, 'HIGH');
      expect(busy.lastUpdated, DateTime.utc(2026, 10, 8, 4, 30));

      expect(silent.totalVehicleCount, isNull);
      expect(silent.averageLaneDensityPercent, isNull);
      expect(silent.congestionLevel, isNull);
      expect(silent.lastUpdated, isNull);
    });

    // ST-FL02
    test('ST-FL02 CameraStatus parses integer density as double and a camera with no reading', () {
      final road = CameraStatus.fromJson({
        'cameraSensorId': 'c1',
        'laneLabel': 'Galle Rd',
        'vehicleCount': 18,
        'laneDensityPercent': 45, // JSON integer → must still become a double
        'congestionLevel': 'MODERATE',
        'lastUpdated': '2026-10-08T04:30:00Z',
      });
      final silent = CameraStatus.fromJson({'cameraSensorId': 'c2', 'laneLabel': 'Back Lane'});

      expect(road.laneDensityPercent, 45.0);
      expect(road.vehicleCount, 18);
      expect(silent.vehicleCount, isNull);
      expect(silent.congestionLevel, isNull);
      expect(silent.lastUpdated, isNull);
    });

    // ST-FL03
    test('ST-FL03 Congestion levels map to the web colours/labels; unknown or null falls back to Low', () {
      expect(congestionLevelFor('SEVERE').label, 'Severe');
      expect(congestionLevelFor('SEVERE').color, const Color(0xFFEF4444));
      expect(congestionLevelFor('HIGH').label, 'High');
      expect(congestionLevelFor('MODERATE').label, 'Moderate');
      expect(congestionLevelFor(null).label, 'Low');
      expect(congestionLevelFor('NOT_A_LEVEL').label, 'Low');

      expect(congestionSeverityRank['SEVERE']! > congestionSeverityRank['HIGH']!, isTrue);
      expect(congestionSeverityRank['HIGH']! > congestionSeverityRank['MODERATE']!, isTrue);
      expect(congestionSeverityRank['MODERATE']! > congestionSeverityRank['LOW']!, isTrue);
      expect(congestionSeverityRank['LOW']! > congestionSeverityRank[null]!, isTrue);
    });
  });

  group('Camera Telemetry — SrmsApi (backend integration contract)', () {
    // ST-FL04
    test('ST-FL04 getIntersections and getCameras call the right endpoints and unwrap ApiResponse', () async {
      final requested = <String>[];
      final client = MockClient((request) async {
        requested.add('${request.method} ${request.url.path}');
        if (request.url.path == '/api/intersections') {
          return _ok([_junction('j1', 'Town Hall', 'LOW')]);
        }
        return _ok([
          {'cameraSensorId': 'c1', 'laneLabel': 'North', 'vehicleCount': 3, 'laneDensityPercent': 7.5, 'congestionLevel': 'LOW'},
        ]);
      });

      final (junctions, cameras) = await http.runWithClient(() async {
        final api = SrmsApi();
        return (await api.getIntersections(), await api.getCameras('j1'));
      }, () => client);

      expect(requested, ['GET /api/intersections', 'GET /api/intersections/j1/cameras']);
      expect(junctions.single.name, 'Town Hall');
      expect(cameras.single.laneLabel, 'North');
    });

    // ST-FL05
    test('ST-FL05 API errors surface the backend message (404 unknown junction, success=false)', () async {
      final client = MockClient((request) async => request.url.path.endsWith('/cameras')
          ? _fail(404, 'Intersection not found.')
          : http.Response(jsonEncode({'success': false, 'message': 'Database unavailable'}), 200));

      await http.runWithClient(() async {
        final api = SrmsApi();
        await expectLater(
            api.getCameras('missing'), throwsA(predicate((e) => e.toString().contains('Intersection not found.'))));
        await expectLater(
            api.getIntersections(), throwsA(predicate((e) => e.toString().contains('Database unavailable'))));
      }, () => client);
    });

    // ST-FL06
    test('ST-FL06 reportCameraFault POSTs the description as JSON and rethrows a 400', () async {
      http.Request? sent;
      final client = MockClient((request) async {
        sent = request;
        final description = (jsonDecode(request.body) as Map<String, dynamic>)['description'] as String;
        return description == 'bad'
            ? _fail(400, 'A description of the fault is required.')
            : _ok({'id': 'f1', 'status': 'OPEN'});
      });

      await http.runWithClient(() async {
        final api = SrmsApi();
        await api.reportCameraFault('cam-7', 'Feed frozen');
        expect(sent!.method, 'POST');
        expect(sent!.url.path, '/api/cameras/cam-7/fault-reports');
        expect(sent!.headers['Content-Type'], startsWith('application/json'));
        expect(jsonDecode(sent!.body), {'description': 'Feed frozen'});

        await expectLater(api.reportCameraFault('cam-7', 'bad'),
            throwsA(predicate((e) => e.toString().contains('A description of the fault is required.'))));
      }, () => client);
    });
  });

  group('Camera Telemetry — CameraStatusScreen widget', () {
    // ST-FL07
    testWidgets('ST-FL07 lists junctions worst-congestion-first with a summary header', (tester) async {
      await _pumpScreen(tester, (request) async => _ok([
            _junction('j1', 'Quiet Junction', 'LOW'),
            _junction('j2', 'No Data Junction', null),
            _junction('j3', 'Gridlock Junction', 'SEVERE'),
            _junction('j4', 'Busy Junction', 'HIGH'),
          ]));

      expect(find.text('4 junctions'), findsOneWidget);
      expect(find.text('1 Severe'), findsOneWidget);
      expect(find.text('1 High'), findsOneWidget);
      expect(find.text('1 Low'), findsOneWidget);
      expect(find.text('Waiting for first camera reading…'), findsOneWidget);

      final order = ['Gridlock Junction', 'Busy Junction', 'Quiet Junction', 'No Data Junction']
          .map((name) => tester.getTopLeft(find.text(name)).dy)
          .toList();
      expect(order, orderedEquals([...order]..sort()));
    });

    // ST-FL08
    testWidgets('ST-FL08 search filters case-insensitively and shows a no-match message', (tester) async {
      await _pumpScreen(tester, (request) async => _ok([
            _junction('j1', 'Town Hall', 'LOW'),
            _junction('j2', 'Kollupitiya', 'HIGH'),
          ]));

      await tester.enterText(find.byType(TextField), 'town');
      await tester.pump();
      expect(find.text('Town Hall'), findsOneWidget);
      expect(find.text('Kollupitiya'), findsNothing);

      await tester.enterText(find.byType(TextField), 'zzz');
      await tester.pump();
      expect(find.text('No junctions match your search.'), findsOneWidget);
    });

    // ST-FL09
    testWidgets('ST-FL09 backend failure shows an error instead of crashing', (tester) async {
      await _pumpScreen(tester, (request) async => _fail(500, 'Internal server error'));

      expect(find.textContaining("Couldn't reach the backend"), findsOneWidget);
      expect(find.textContaining('Internal server error'), findsOneWidget);
    });

    // ST-FL10
    testWidgets('ST-FL10 empty database shows the empty state', (tester) async {
      await _pumpScreen(tester, (request) async => _ok([]));

      expect(find.text('No junctions in the database yet.'), findsOneWidget);
    });

    // ST-FL11
    testWidgets('ST-FL11 tapping a junction loads its per-road camera breakdown', (tester) async {
      Future<http.Response> backend(http.Request request) async {
        if (request.url.path == '/api/intersections') return _ok([_junction('j1', 'Town Hall', 'HIGH')]);
        return _ok([
          {'cameraSensorId': 'c1', 'laneLabel': 'North Rd', 'vehicleCount': 27, 'laneDensityPercent': 88.0, 'congestionLevel': 'SEVERE'},
          {'cameraSensorId': 'c2', 'laneLabel': 'Back Lane'},
        ]);
      }

      await _pumpScreen(tester, backend);
      await http.runWithClient(() async {
        await tester.tap(find.text('Town Hall'));
        await tester.pump();
        await tester.pump();
      }, () => MockClient(backend));

      expect(find.text('Road breakdown'), findsOneWidget);
      expect(find.text('North Rd'), findsOneWidget);
      expect(find.text('27 vehicles'), findsOneWidget);
      expect(find.text('Severe'), findsOneWidget);
      expect(find.text('Back Lane'), findsOneWidget);
      expect(find.text('No reading yet'), findsOneWidget);
    });

    // ST-FL12
    testWidgets('ST-FL12 report-fault dialog sends the fault; a blank description sends nothing', (tester) async {
      final faultPosts = <String>[];
      Future<http.Response> backend(http.Request request) async {
        if (request.method == 'POST') {
          faultPosts.add('${request.url.path} ${request.body}');
          return _ok({'id': 'f1', 'status': 'OPEN'});
        }
        if (request.url.path == '/api/intersections') return _ok([_junction('j1', 'Town Hall', 'HIGH')]);
        return _ok([
          {'cameraSensorId': 'c1', 'laneLabel': 'North Rd', 'vehicleCount': 27, 'laneDensityPercent': 88.0, 'congestionLevel': 'SEVERE'},
        ]);
      }

      await _pumpScreen(tester, backend);
      await http.runWithClient(() async {
        await tester.tap(find.text('Town Hall'));
        await tester.pump();
        await tester.pump();

        // Blank description → dialog closes, no API call.
        await tester.tap(find.byTooltip('Report fault'));
        await tester.pumpAndSettle();
        expect(find.text('Report fault — North Rd'), findsOneWidget);
        await tester.enterText(find.byType(TextField).last, '   ');
        await tester.tap(find.text('Report'));
        await tester.pumpAndSettle();
        expect(faultPosts, isEmpty);

        // Real description → POST + confirmation snackbar.
        await tester.tap(find.byTooltip('Report fault'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).last, 'Feed frozen');
        await tester.tap(find.text('Report'));
        await tester.pumpAndSettle();
      }, () => MockClient(backend));

      expect(faultPosts, ['/api/cameras/c1/fault-reports {"description":"Feed frozen"}']);
      expect(find.text('Fault reported for North Rd.'), findsOneWidget);
    });
  });
}
