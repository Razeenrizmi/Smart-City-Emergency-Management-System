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
      latitude: latitude,
      longitude: longitude,
      timestamp: DateTime.utc(2026, 1, 1),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('HazardReportModel', () {
    test('toJson formats coordinates, spike and timestamp', () {
      final created = DateTime.utc(2026, 1, 2, 3, 4, 5);
      final model = HazardReportModel(
        latitude: 6.9271,
        longitude: 79.8850,
        accelerometerZSpike: 12.5,
        hazardType: 'POTHOLE',
        createdAt: created,
      );

      final json = model.toJson();

      expect(json['latitude'], 6.9271);
      expect(json['longitude'], 79.8850);
      expect(json['accelerometerZSpike'], 12.5);
      expect(json['hazardType'], 'POTHOLE');
      expect(json['severityScore'], 1);
      expect(json['isVerified'], false);
      expect(json['createdAt'], created.toIso8601String());
    });

    test('toJson omits createdAt when not set', () {
      final model = HazardReportModel(latitude: 1, longitude: 2, accelerometerZSpike: 3);
      expect(model.toJson().containsKey('createdAt'), isFalse);
    });

    test('fromJson round-trips a payload', () {
      final model = HazardReportModel.fromJson({
        'latitude': 6.9271,
        'longitude': 79.8850,
        'accelerometerZSpike': 12.5,
        'hazardType': 'POTHOLE',
        'createdAt': '2026-01-02T03:04:05.000Z',
      });

      expect(model.latitude, 6.9271);
      expect(model.longitude, 79.8850);
      expect(model.accelerometerZSpike, 12.5);
      expect(model.hazardType, 'POTHOLE');
      expect(model.createdAt, DateTime.parse('2026-01-02T03:04:05.000Z'));
    });
  });

  group('HazardApiService.postHazardReport', () {
    late MockHttpClient client;

    setUp(() {
      client = MockHttpClient();
    });

    setUpAll(() {
      registerFallbackValue(Uri());
    });

    test('200 returns success with the decoded body', () async {
      when(() => client.post(any(), headers: any(named: 'headers'), body: any(named: 'body')))
          .thenAnswer((_) async => http.Response(jsonEncode({'success': true, 'id': 'h1'}), 200));

      final result = await HazardApiService.postHazardReport(
        HazardReportModel(latitude: 6.9, longitude: 79.8, accelerometerZSpike: 12.5),
        client,
      );

      expect(result['success'], isTrue);
      expect((result['data'] as Map)['id'], 'h1');
    });

    test('500 returns a failure result', () async {
      when(() => client.post(any(), headers: any(named: 'headers'), body: any(named: 'body')))
          .thenAnswer((_) async => http.Response('boom', 500));

      final result = await HazardApiService.postHazardReport(
        HazardReportModel(latitude: 6.9, longitude: 79.8, accelerometerZSpike: 12.5),
        client,
      );

      expect(result['success'], isFalse);
      expect(result['error'], contains('500'));
    });

    test('network failure is caught and returned as a failure result', () async {
      when(() => client.post(any(), headers: any(named: 'headers'), body: any(named: 'body')))
          .thenAnswer((_) async => throw const SocketException('no route to host'));

      final result = await HazardApiService.postHazardReport(
        HazardReportModel(latitude: 6.9, longitude: 79.8, accelerometerZSpike: 12.5),
        client,
      );

      expect(result['success'], isFalse);
      expect(result['error'], contains('no route to host'));
    });
  });

  group('HazardDetectionScreen', () {
    Future<void> pumpScreen(
      WidgetTester tester, {
      required Stream<AccelerometerEvent> accelStream,
      required Future<Map<String, dynamic>> Function(HazardReportModel) onReport,
    }) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(MaterialApp(
        home: HazardDetectionScreen(
          positionProvider: () async => _fakePosition(),
          positionStreamProvider: () => const Stream<Position>.empty(),
          accelerometerStreamFactory: () => accelStream,
          reportSender: onReport,
        ),
      ));
      await tester.pump();
    }

    testWidgets('Start Monitoring switches the control to Stop and shows MONITORING',
        (tester) async {
      final accel = StreamController<AccelerometerEvent>.broadcast();
      addTearDown(accel.close);

      await pumpScreen(tester, accelStream: accel.stream, onReport: (_) async => {'success': true});

      // Move to the HUD tab where the status card is rendered.
      await tester.tap(find.text('Sensor & AI HUD'));
      await tester.pump();

      expect(find.byKey(const ValueKey('start')), findsOneWidget);
      expect(find.text('Start Monitoring'), findsOneWidget);

      await tester.ensureVisible(find.byKey(const ValueKey('start')));
      await tester.tap(find.byKey(const ValueKey('start')));
      await tester.pump(); // position provider future
      await tester.pump(const Duration(milliseconds: 400)); // button switch animation

      expect(find.byKey(const ValueKey('stop')), findsOneWidget);
      expect(find.text('Stop Monitoring'), findsOneWidget);
      expect(find.text('MONITORING'), findsOneWidget);

      await tester.pumpWidget(const SizedBox()); // dispose -> cancel streams/timers
    });

    testWidgets('spike logic: below threshold is ignored, >= threshold reports once with cooldown',
        (tester) async {
      final accel = StreamController<AccelerometerEvent>.broadcast();
      addTearDown(accel.close);
      final reports = <HazardReportModel>[];

      await pumpScreen(
        tester,
        accelStream: accel.stream,
        onReport: (report) async {
          reports.add(report);
          return {
            'success': true,
            'data': {'id': 'hazard-1'},
          };
        },
      );

      await tester.ensureVisible(find.byKey(const ValueKey('start')));
      await tester.tap(find.byKey(const ValueKey('start')));
      await tester.pump(); // resolve position provider
      await tester.pump();

      // Below the 11.5 threshold -> no network call.
      accel.add(AccelerometerEvent(1, 1, 5, DateTime.now()));
      await tester.pump();
      expect(reports, isEmpty);

      // Above the threshold -> exactly one report.
      accel.add(AccelerometerEvent(1, 1, 12, DateTime.now()));
      await tester.pump();
      await tester.pump();
      expect(reports.length, 1);
      expect(reports.single.accelerometerZSpike, 12);

      // Second spike during the 5s cooldown -> ignored.
      accel.add(AccelerometerEvent(1, 1, 20, DateTime.now()));
      await tester.pump();
      await tester.pump();
      expect(reports.length, 1);

      await tester.pumpWidget(const SizedBox()); // dispose -> cancel cooldown timer
    });

    testWidgets('API failure shows an error status without crashing', (tester) async {
      final accel = StreamController<AccelerometerEvent>.broadcast();
      addTearDown(accel.close);

      await pumpScreen(
        tester,
        accelStream: accel.stream,
        onReport: (_) async => {'success': false, 'error': 'Server responded with status 500'},
      );

      await tester.tap(find.text('Sensor & AI HUD'));
      await tester.pump();

      await tester.ensureVisible(find.byKey(const ValueKey('start')));
      await tester.tap(find.byKey(const ValueKey('start')));
      await tester.pump();
      await tester.pump();

      accel.add(AccelerometerEvent(1, 1, 12, DateTime.now()));
      await tester.pump();
      await tester.pump();

      expect(find.textContaining('Failed: Server responded with status 500'), findsWidgets);

      await tester.pumpWidget(const SizedBox());
    });
  });
}
