import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/models/scan_result.dart';

void main() {
  test('ScanResult parses the ASP.NET scan envelope (camelCase)', () {
    final result = ScanResult.fromJson({
      'logId': 'LOG-1001',
      'detectedPlate': 'CCA 2101',
      'confidence': 91.5,
      'plateConfidence': 0.87,
      'vehicleConfidence': 0.93,
      'vehicleInfo': 'Toyota Aqua · Silver',
      'vehicleType': 'car',
      'isMatch': true,
      'crimeStatus': 'WANTED',
      'riskLevel': 'HIGH',
      'detectionStatus': 'POSSIBLE_CRIME_MATCH',
      'validationStatus': 'REQUIRES_OFFICER_REVIEW',
      'scannedAt': '2026-09-23 10:00:00',
      'nodeId': 2,
      'sessionId': 'NODE2-SESSION-001',
      'trackId': 7,
      'isDuplicate': false,
      'frameStats': {
        'frameNumber': 42,
        'timestamp': '2026-09-23T10:00:00Z',
        'processingMs': 183.4,
        'aiFps': 4.6,
        'targetAiFps': 5,
        'frameIntervalMs': 200,
        'detectionCount': 1,
        'trackCount': 2,
      },
      'trackingInfo': {
        'totalActiveTracks': 2,
        'totalProcessedTracks': 5,
      },
    });

    expect(result.logId, 'LOG-1001');
    expect(result.detectedPlate, 'CCA 2101');
    expect(result.isMatch, isTrue);
    expect(result.detectionStatus, 'POSSIBLE_CRIME_MATCH');
    expect(result.nodeId, 2);
    expect(result.sessionId, 'NODE2-SESSION-001');
    expect(result.trackId, 7);
    expect(result.isDuplicate, isFalse);
    expect(result.frameStats?.aiFps, 4.6);
    expect(result.frameStats?.processingMs, 183.4);
    expect(result.trackingInfo?.totalActiveTracks, 2);
    expect(result.shouldDisplay, isTrue);
    expect(result.isCrimeVehicle, isTrue);
  });

  test('Duplicate / confirmation statuses are never displayed (evidence rule)', () {
    Map<String, dynamic> base(String status, {bool duplicate = false}) => {
          'detectionStatus': status,
          'isDuplicate': duplicate,
        };

    expect(ScanResult.fromJson(base('ALL_VEHICLES_TRACKED')).shouldDisplay,
        isFalse);
    expect(ScanResult.fromJson(base('DUPLICATE_PLATE')).shouldDisplay, isFalse);
    expect(
        ScanResult.fromJson(base('ALREADY_PROCESSED')).shouldDisplay, isFalse);
    expect(ScanResult.fromJson(base('AWAITING_CONFIRMATION')).shouldDisplay,
        isFalse);
    expect(
        ScanResult.fromJson(base('NO_CRIME_MATCH', duplicate: true))
            .shouldDisplay,
        isFalse);
    expect(ScanResult.fromJson(base('COOLDOWN_SUPPRESSED')).shouldDisplay,
        isTrue);
    expect(ScanResult.fromJson(base('NO_CRIME_MATCH')).shouldDisplay, isTrue);
  });

  test('AI service outage surfaces as AI_SERVICE_UNAVAILABLE, not a result', () {
    final result = ScanResult.fromJson({
      'detectionStatus': 'AI_SERVICE_UNAVAILABLE',
      'vehicleInfo': 'AI detection service unavailable: connection refused',
    });
    expect(result.isBackendDown, isTrue);
    expect(result.isCrimeVehicle, isFalse);
    expect(result.frameStats, isNull);
  });
}
