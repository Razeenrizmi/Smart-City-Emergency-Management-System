import '../models/dashboard_stats.dart';
import '../models/detection_config.dart';
import 'api_client.dart';

class DashboardService {
  DashboardService._();
  static final DashboardService instance = DashboardService._();

  final ApiClient _api = ApiClient.instance;

  Future<DashboardStats> getStatistics() async {
    final res = await _api.get(
      '/dashboard/statistics',
      decode: (raw) => DashboardStats.fromJson(
        (raw as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
    return res.data ?? DashboardStats.empty();
  }

  Future<DetectionConfig?> getConfig() async {
    final res = await _api.get(
      '/detection/config',
      decode: (raw) => DetectionConfig.fromJson(
        (raw as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
    return res.data;
  }
}
