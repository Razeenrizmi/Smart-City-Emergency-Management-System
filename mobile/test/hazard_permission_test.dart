import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';

import 'package:mobile/models/hazard_report_model.dart';
import 'package:mobile/screens/hazard_detection_screen.dart';

Position _position() => Position(
      latitude: 6.9271,
      longitude: 79.8850,
      timestamp: DateTime.utc(2026, 1, 1),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

/// Pumps the hazard screen with mocked location + sensor providers, so the
/// permission-denial flows can be exercised without any hardware.
Future<void> _pumpScreen(
  WidgetTester tester, {
  required Future<Position> Function() positionProvider,
  Future<Map<String, dynamic>> Function(HazardReportModel)? onReport,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  await tester.pumpWidget(MaterialApp(
    home: HazardDetectionScreen(
      positionProvider: positionProvider,
      positionStreamProvider: () => const Stream<Position>.empty(),
      accelerometerStreamFactory: () => const Stream<AccelerometerEvent>.empty(),
      reportSender: onReport ?? (_) async => {'success': true, 'data': {'id': 'h1'}},
    ),
  ));
  await tester.pump();

  // Move to the HUD tab where the status card and control buttons are rendered.
  await tester.tap(find.text('Sensor & AI HUD'));
  await tester.pump();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('HD-P-01: denied location permission surfaces an error, app stays usable',
      (tester) async {
    await _pumpScreen(
      tester,
      positionProvider: () async => throw Exception('Location permissions are denied.'),
    );

    await tester.ensureVisible(find.byKey(const ValueKey('start')));
    await tester.tap(find.byKey(const ValueKey('start')));
    await tester.pump(); // resolve the throwing position provider
    await tester.pump();

    expect(find.textContaining('Error:'), findsWidgets);
    expect(find.textContaining('denied'), findsWidgets);
    // The screen must remain interactive after a denied permission.
    expect(find.byKey(const ValueKey('start')), findsOneWidget);
  });

  testWidgets('HD-P-02: disabled location service is reported clearly', (tester) async {
    await _pumpScreen(
      tester,
      positionProvider: () async =>
          throw Exception('Location services are disabled. Please enable them in Settings.'),
    );

    await tester.ensureVisible(find.byKey(const ValueKey('start')));
    await tester.tap(find.byKey(const ValueKey('start')));
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('disabled'), findsWidgets);
  });

  testWidgets('HD-M-09: manual report uses a default spike when none was detected',
      (tester) async {
    final sent = <HazardReportModel>[];
    await _pumpScreen(
      tester,
      positionProvider: () async => _position(),
      onReport: (report) async {
        sent.add(report);
        return {'success': true, 'data': {'id': 'h1'}};
      },
    );

    await tester.ensureVisible(find.textContaining('Manual Report'));
    await tester.tap(find.textContaining('Manual Report'));
    await tester.pump();
    await tester.pump();

    expect(sent, isNotEmpty);
    expect(sent.single.accelerometerZSpike, 5.0);
    expect(sent.single.latitude, 6.9271);
    expect(sent.single.longitude, 79.8850);
  });
}
