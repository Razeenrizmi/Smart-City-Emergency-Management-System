/// `GET /api/dashboard/statistics` → DashboardStatisticsResponse
class DashboardStats {
  final int totalCctvNodes;
  final int onlineNodes;
  final int offlineNodes;
  final int activeAlerts;
  final int todayAlerts;
  final int totalDetections;
  final int detectionsToday;
  final int crimeVehicles;
  final int activeSessions;
  final int activeTracks;
  final int vehiclesToday;
  final int targetAiFps;
  final double? measuredAiFps;
  final bool aiServiceOnline;
  final String generatedAt;

  const DashboardStats({
    required this.totalCctvNodes,
    required this.onlineNodes,
    required this.offlineNodes,
    required this.activeAlerts,
    required this.todayAlerts,
    required this.totalDetections,
    required this.detectionsToday,
    required this.crimeVehicles,
    required this.activeSessions,
    required this.activeTracks,
    required this.vehiclesToday,
    required this.targetAiFps,
    required this.measuredAiFps,
    required this.aiServiceOnline,
    required this.generatedAt,
  });

  factory DashboardStats.empty() => const DashboardStats(
        totalCctvNodes: 0,
        onlineNodes: 0,
        offlineNodes: 0,
        activeAlerts: 0,
        todayAlerts: 0,
        totalDetections: 0,
        detectionsToday: 0,
        crimeVehicles: 0,
        activeSessions: 0,
        activeTracks: 0,
        vehiclesToday: 0,
        targetAiFps: 5,
        measuredAiFps: null,
        aiServiceOnline: false,
        generatedAt: '',
      );

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalCctvNodes: (json['totalCctvNodes'] as num?)?.toInt() ?? 0,
      onlineNodes: (json['onlineNodes'] as num?)?.toInt() ?? 0,
      offlineNodes: (json['offlineNodes'] as num?)?.toInt() ?? 0,
      activeAlerts: (json['activeAlerts'] as num?)?.toInt() ?? 0,
      todayAlerts: (json['todayAlerts'] as num?)?.toInt() ?? 0,
      totalDetections: (json['totalDetections'] as num?)?.toInt() ?? 0,
      detectionsToday: (json['detectionsToday'] as num?)?.toInt() ?? 0,
      crimeVehicles: (json['crimeVehicles'] as num?)?.toInt() ?? 0,
      activeSessions: (json['activeSessions'] as num?)?.toInt() ?? 0,
      activeTracks: (json['activeTracks'] as num?)?.toInt() ?? 0,
      vehiclesToday: (json['vehiclesToday'] as num?)?.toInt() ?? 0,
      targetAiFps: (json['targetAiFps'] as num?)?.toInt() ?? 5,
      measuredAiFps: (json['measuredAiFps'] as num?)?.toDouble(),
      aiServiceOnline: json['aiServiceOnline'] == true,
      generatedAt: (json['generatedAt'] as String?) ?? '',
    );
  }

  /// Honest FPS display — never forces measured to equal target.
  String get measuredFpsLabel {
    if (!aiServiceOnline || measuredAiFps == null) return '—';
    return measuredAiFps!.toStringAsFixed(1);
  }
}
