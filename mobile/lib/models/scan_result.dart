/// `POST /api/crime-vehicle/scan` → `ScanResultResponse` (camelCase JSON).
/// Same contract the web client consumes — nothing is invented on device.
class ScanResult {
  final String logId;
  final String detectedPlate;
  final double confidence;
  final double plateConfidence;
  final double vehicleConfidence;
  final String vehicleInfo;
  final String vehicleType;
  final bool isMatch;
  final String crimeStatus;
  final String riskLevel;
  final String detectionStatus;
  final String validationStatus;
  final String scannedAt;
  final int nodeId;
  final String sessionId;
  final int? trackId;
  final bool isDuplicate;
  final HotlistMatch? matchedVehicle;
  final FrameStats? frameStats;
  final TrackingInfo? trackingInfo;

  const ScanResult({
    required this.logId,
    required this.detectedPlate,
    required this.confidence,
    required this.plateConfidence,
    required this.vehicleConfidence,
    required this.vehicleInfo,
    required this.vehicleType,
    required this.isMatch,
    required this.crimeStatus,
    required this.riskLevel,
    required this.detectionStatus,
    required this.validationStatus,
    required this.scannedAt,
    required this.nodeId,
    required this.sessionId,
    required this.trackId,
    required this.isDuplicate,
    required this.matchedVehicle,
    required this.frameStats,
    required this.trackingInfo,
  });

  /// Statuses the monitor must NOT display as a result
  /// (evidence rule — same skip list as the web LiveANPRMonitor).
  static const skipStatuses = {
    'ALL_VEHICLES_TRACKED',
    'DUPLICATE_PLATE',
    'ALREADY_PROCESSED',
    'AWAITING_CONFIRMATION',
  };

  bool get shouldDisplay =>
      !isDuplicate && !skipStatuses.contains(detectionStatus);

  bool get isCrimeVehicle =>
      isMatch && detectionStatus == 'POSSIBLE_CRIME_MATCH';

  bool get isBackendDown => detectionStatus == 'AI_SERVICE_UNAVAILABLE';

  factory ScanResult.fromJson(Map<String, dynamic> json) {
    return ScanResult(
      logId: (json['logId'] as String?) ?? '',
      detectedPlate: (json['detectedPlate'] as String?) ?? '',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      plateConfidence: (json['plateConfidence'] as num?)?.toDouble() ?? 0,
      vehicleConfidence: (json['vehicleConfidence'] as num?)?.toDouble() ?? 0,
      vehicleInfo: (json['vehicleInfo'] as String?) ?? '',
      vehicleType: (json['vehicleType'] as String?) ?? '',
      isMatch: json['isMatch'] == true,
      crimeStatus: (json['crimeStatus'] as String?) ?? 'CLEARED',
      riskLevel: (json['riskLevel'] as String?) ?? 'LOW',
      detectionStatus: (json['detectionStatus'] as String?) ?? 'IDLE',
      validationStatus:
          (json['validationStatus'] as String?) ?? 'CLEARED_BY_SAFETY_AGENT',
      scannedAt: (json['scannedAt'] as String?) ?? '',
      nodeId: (json['nodeId'] as num?)?.toInt() ?? 0,
      sessionId: (json['sessionId'] as String?) ?? '',
      trackId: (json['trackId'] as num?)?.toInt(),
      isDuplicate: json['isDuplicate'] == true,
      matchedVehicle: json['matchedVehicle'] is Map
          ? HotlistMatch.fromJson(
              (json['matchedVehicle'] as Map).cast<String, dynamic>(),
            )
          : null,
      frameStats: json['frameStats'] is Map
          ? FrameStats.fromJson(
              (json['frameStats'] as Map).cast<String, dynamic>(),
            )
          : null,
      trackingInfo: json['trackingInfo'] is Map
          ? TrackingInfo.fromJson(
              (json['trackingInfo'] as Map).cast<String, dynamic>(),
            )
          : null,
    );
  }
}

/// Hotlist vehicle attached to a crime match (`matchedVehicle`).
class HotlistMatch {
  final String plateNumber;
  final String makeModel;
  final String color;
  final String threatLevel;
  final String incidentType;
  final String status;
  final String notes;

  const HotlistMatch({
    required this.plateNumber,
    required this.makeModel,
    required this.color,
    required this.threatLevel,
    required this.incidentType,
    required this.status,
    required this.notes,
  });

  factory HotlistMatch.fromJson(Map<String, dynamic> json) {
    return HotlistMatch(
      plateNumber: (json['plateNumber'] as String?) ?? '',
      makeModel: (json['makeModel'] as String?) ?? '',
      color: (json['color'] as String?) ?? '',
      threatLevel: (json['threatLevel'] as String?) ?? '',
      incidentType: (json['incidentType'] as String?) ?? '',
      status: (json['status'] as String?) ?? '',
      notes: (json['notes'] as String?) ?? '',
    );
  }
}

/// Server-measured frame statistics — AI FPS is never estimated on device.
class FrameStats {
  final int frameNumber;
  final String timestamp;
  final double processingMs;
  final double aiFps;
  final int targetAiFps;
  final int frameIntervalMs;
  final int detectionCount;
  final int trackCount;

  const FrameStats({
    required this.frameNumber,
    required this.timestamp,
    required this.processingMs,
    required this.aiFps,
    required this.targetAiFps,
    required this.frameIntervalMs,
    required this.detectionCount,
    required this.trackCount,
  });

  factory FrameStats.fromJson(Map<String, dynamic> json) {
    return FrameStats(
      frameNumber: (json['frameNumber'] as num?)?.toInt() ?? 0,
      timestamp: (json['timestamp'] as String?) ?? '',
      processingMs: (json['processingMs'] as num?)?.toDouble() ?? 0,
      aiFps: (json['aiFps'] as num?)?.toDouble() ?? 0,
      targetAiFps: (json['targetAiFps'] as num?)?.toInt() ?? 0,
      frameIntervalMs: (json['frameIntervalMs'] as num?)?.toInt() ?? 0,
      detectionCount: (json['detectionCount'] as num?)?.toInt() ?? 0,
      trackCount: (json['trackCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class TrackingInfo {
  final int totalActiveTracks;
  final int totalProcessedTracks;

  const TrackingInfo({
    required this.totalActiveTracks,
    required this.totalProcessedTracks,
  });

  factory TrackingInfo.fromJson(Map<String, dynamic> json) {
    return TrackingInfo(
      totalActiveTracks: (json['totalActiveTracks'] as num?)?.toInt() ?? 0,
      totalProcessedTracks: (json['totalProcessedTracks'] as num?)?.toInt() ?? 0,
    );
  }
}
