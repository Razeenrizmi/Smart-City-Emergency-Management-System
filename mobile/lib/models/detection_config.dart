/// `GET /api/detection/config` → DetectionConfigResponse
class DetectionConfig {
  final int targetAiFps;
  final int frameIntervalMs;
  final double confidenceThreshold;
  final int confirmationFrames;
  final double ocrConfidenceThreshold;
  final double alertCooldownSeconds;

  const DetectionConfig({
    required this.targetAiFps,
    required this.frameIntervalMs,
    required this.confidenceThreshold,
    required this.confirmationFrames,
    required this.ocrConfidenceThreshold,
    required this.alertCooldownSeconds,
  });

  factory DetectionConfig.fromJson(Map<String, dynamic> json) {
    return DetectionConfig(
      targetAiFps: (json['targetAiFps'] as num?)?.toInt() ?? 5,
      frameIntervalMs: (json['frameIntervalMs'] as num?)?.toInt() ?? 200,
      confidenceThreshold:
          (json['confidenceThreshold'] as num?)?.toDouble() ?? 0.6,
      confirmationFrames: (json['confirmationFrames'] as num?)?.toInt() ?? 3,
      ocrConfidenceThreshold:
          (json['ocrConfidenceThreshold'] as num?)?.toDouble() ?? 0.3,
      alertCooldownSeconds:
          (json['alertCooldownSeconds'] as num?)?.toDouble() ?? 60,
    );
  }
}
