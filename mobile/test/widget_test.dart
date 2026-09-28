import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:mobile/main.dart';
import 'package:mobile/models/emergency_session.dart';
import 'package:mobile/models/route.dart' as route_model;
import 'package:mobile/screens/create_emergency_screen.dart';
import 'package:mobile/screens/emergency_session_screen.dart';
import 'package:mobile/services/emergency_service.dart';
import 'package:mobile/services/route_service.dart';

void main() {
  group('Emergency Green Wave Mobile Tests', () {
    testWidgets('Home screen renders Emergency Green Wave title and navigation buttons', (WidgetTester tester) async {
      await tester.pumpWidget(const MyApp());

      expect(find.text('Emergency Green Wave'), findsWidgets);
      expect(find.text('Emergency Green Wave System'), findsOneWidget);
      expect(find.text('Select Route'), findsOneWidget);
      expect(find.text('Create Emergency'), findsOneWidget);
    });

    test('RouteService retrieves and deserializes routes via HTTP client', () async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/routes')) {
          return http.Response(
            json.encode([
              {
                'routeId': '22222222-2222-2222-2222-222222222201',
                'routeName': 'Hospital Express Route',
                'startLocation': 'Depot 1',
                'destination': 'Central Hospital',
                'distanceKm': 4.8,
                'estimatedTimeMinutes': 10,
                'trafficLevel': 'HIGH',
                'junctions': [],
              }
            ]),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final service = RouteService(client: mockClient);
      final routes = await service.getAllRoutes();

      expect(routes.length, 1);
      expect(routes.first.routeId, '22222222-2222-2222-2222-222222222201');
      expect(routes.first.routeName, 'Hospital Express Route');
      expect(routes.first.distanceKm, 4.8);
      service.dispose();
    });

    testWidgets('CreateEmergencyScreen displays selected route and validates required fields', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final selectedRoute = route_model.Route(
        routeId: '22222222-2222-2222-2222-222222222201',
        routeName: 'Hospital Express Route',
        startLocation: 'Depot 1',
        destination: 'Central Hospital',
        distanceKm: 4.8,
        estimatedTimeMinutes: 10,
        trafficLevel: 'HIGH',
        junctions: [],
      );

      await tester.pumpWidget(MaterialApp(
        home: CreateEmergencyScreen(selectedRoute: selectedRoute),
      ));

      expect(find.text('Selected Route'), findsOneWidget);
      expect(find.text('Hospital Express Route'), findsOneWidget);

      final submitFinder = find.widgetWithText(ElevatedButton, 'Create Emergency Session');
      await tester.ensureVisible(submitFinder);
      await tester.tap(submitFinder);
      await tester.pumpAndSettle();

      expect(find.text('Driver ID is required'), findsOneWidget);
      expect(find.text('Vehicle type is required'), findsOneWidget);

      final driverIdField = find.widgetWithText(TextFormField, 'Driver ID');
      await tester.enterText(driverIdField, 'not-a-valid-guid');
      await tester.tap(submitFinder);
      await tester.pumpAndSettle();

      expect(
        find.text('Please enter a valid GUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)'),
        findsOneWidget,
      );
    });

    testWidgets('EmergencySessionScreen hides activation and completion before AI approval and activation', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final activeSession = EmergencySession(
        sessionId: '11111111-1111-1111-1111-111111111101',
        driverId: '99999999-9999-9999-9999-999999999991',
        vehicleType: 'Ambulance',
        status: 'ACTIVE',
        selectedRouteId: '22222222-2222-2222-2222-222222222201',
        createdAt: DateTime.parse('2026-09-25T10:00:00Z'),
        updatedAt: DateTime.parse('2026-09-25T10:00:00Z'),
      );

      await tester.pumpWidget(MaterialApp(
        home: EmergencySessionScreen(session: activeSession),
      ));

      expect(find.text('ACTIVE'), findsOneWidget);
      expect(find.text('Session Actions'), findsOneWidget);
      expect(find.text('Activate Green Wave'), findsNothing);
      expect(find.text('Complete Emergency'), findsNothing);
      expect(find.text('Cancel Emergency'), findsOneWidget);
    });

    testWidgets('EmergencySessionScreen displays approved AI workflow and activation action', (WidgetTester tester) async {
      final activeSession = EmergencySession(
        sessionId: '11111111-1111-1111-1111-111111111103',
        driverId: '99999999-9999-9999-9999-999999999991',
        vehicleType: 'Ambulance',
        status: 'ACTIVE',
        selectedRouteId: '22222222-2222-2222-2222-222222222201',
        createdAt: DateTime.parse('2026-09-25T10:00:00Z'),
        updatedAt: DateTime.parse('2026-09-25T10:00:00Z'),
      );
      final service = EmergencyService(
        client: MockClient((request) async => http.Response(
          jsonEncode({
            'workflowStatus': 'COMPLETED',
            'proposalStatus': 'APPROVED',
            'approvalStatus': 'APPROVED',
            'isValid': true,
            'handoffReady': true,
            'signalExecutionPerformed': false,
          }),
          200,
        )),
      );

      await tester.pumpWidget(MaterialApp(
        home: EmergencySessionScreen(session: activeSession, emergencyService: service),
      ));
      await tester.pumpAndSettle();

      expect(find.text('AI Workflow Status'), findsOneWidget);
      expect(find.text('APPROVED'), findsWidgets);
      expect(find.text('READY'), findsOneWidget);
      expect(find.text('Activate Green Wave'), findsOneWidget);
      expect(find.text('Complete Emergency'), findsNothing);
    });

    testWidgets('EmergencySessionScreen hides action buttons for terminal sessions', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final completedSession = EmergencySession(
        sessionId: '11111111-1111-1111-1111-111111111102',
        driverId: '99999999-9999-9999-9999-999999999991',
        vehicleType: 'Ambulance',
        status: 'COMPLETED',
        selectedRouteId: '22222222-2222-2222-2222-222222222201',
        createdAt: DateTime.parse('2026-09-25T10:00:00Z'),
        updatedAt: DateTime.parse('2026-09-25T10:05:00Z'),
      );

      await tester.pumpWidget(MaterialApp(
        home: EmergencySessionScreen(session: completedSession),
      ));

      expect(find.text('COMPLETED'), findsOneWidget);
      expect(find.text('Session actions are only available for ACTIVE sessions.'), findsOneWidget);
      expect(find.text('Complete Emergency'), findsNothing);
      expect(find.text('Cancel Emergency'), findsNothing);
    });

    test('EmergencyService creates session with selected route and throws on server failure', () async {
      final successClient = MockClient((request) async {
        if (request.url.path.endsWith('/emergencies')) {
          final body = json.decode(request.body) as Map<String, dynamic>;
          return http.Response(
            json.encode({
              'sessionId': '11111111-1111-1111-1111-111111111101',
              'driverId': body['driverId'],
              'vehicleType': body['vehicleType'],
              'status': 'ACTIVE',
              'selectedRouteId': body['selectedRouteId'],
              'createdAt': '2026-09-25T10:00:00.000Z',
              'updatedAt': '2026-09-25T10:00:00.000Z',
            }),
            201,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final successService = EmergencyService(client: successClient);
      final session = await successService.createEmergencySession(
        driverId: '99999999-9999-9999-9999-999999999991',
        vehicleType: 'Ambulance',
        selectedRouteId: '22222222-2222-2222-2222-222222222201',
      );

      expect(session.status, 'ACTIVE');
      expect(session.selectedRouteId, '22222222-2222-2222-2222-222222222201');
      successService.dispose();

      final failClient = MockClient((request) async => http.Response('Server error', 500));
      final failService = EmergencyService(client: failClient);

      expect(
        () => failService.createEmergencySession(
          driverId: '99999999-9999-9999-9999-999999999991',
          vehicleType: 'Ambulance',
        ),
        throwsException,
      );
      failService.dispose();
    });
  });
}
