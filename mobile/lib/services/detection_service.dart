import '../models/api_response.dart';
import '../models/detection_log.dart';
import 'api_client.dart';

/// Detection / alert queries against existing backend routes.
class DetectionService {
  DetectionService._();
  static final DetectionService instance = DetectionService._();

  final ApiClient _api = ApiClient.instance;

  /// Paged history — `GET /api/detection/history`.
  Future<List<DetectionLog>> getHistory({
    int? nodeId,
    String? plate,
    String? vehicleType,
    bool? crimeMatch,
    String? status,
    String? from,
    String? to,
    int limit = 20,
    int offset = 0,
  }) async {
    final query = <String, String>{
      'limit': '$limit',
      'offset': '$offset',
    };
    if (nodeId != null) query['nodeId'] = '$nodeId';
    if (plate != null && plate.isNotEmpty) query['plate'] = plate;
    if (vehicleType != null && vehicleType.isNotEmpty) {
      query['vehicleType'] = vehicleType;
    }
    if (crimeMatch != null) query['crimeMatch'] = '$crimeMatch';
    if (status != null && status.isNotEmpty) query['status'] = status;
    if (from != null && from.isNotEmpty) query['from'] = from;
    if (to != null && to.isNotEmpty) query['to'] = to;

    final res = await _api.get(
      '/detection/history',
      query: query,
      decode: (raw) => _api.decodeList(raw, DetectionLog.fromJson),
    );
    return res.data ?? const [];
  }

  /// Active crime alerts (pending officer review).
  Future<List<DetectionLog>> getActiveAlerts({int limit = 50}) {
    return getHistory(status: 'REQUIRES_OFFICER_REVIEW', limit: limit);
  }

  /// Recent vehicle tracks (backend TrackIds — never generated on device).
  Future<List<DetectionLog>> getRecentVehicles({int limit = 30}) {
    return getHistory(limit: limit);
  }

  /// Alert / detection detail — `GET /api/crime-vehicle/logs/{logId}`.
  Future<DetectionLog> getLog(String logId) async {
    final res = await _api.get(
      '/crime-vehicle/logs/$logId',
      decode: (raw) => DetectionLog.fromJson(
        (raw as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
    if (res.data == null) {
      throw ApiException('Alert $logId not found.');
    }
    return res.data!;
  }

  Future<List<DetectionLog>> getObservations(String plate) async {
    final res = await _api.get(
      '/detection/observations/${Uri.encodeComponent(plate)}',
      decode: (raw) => _api.decodeList(raw, DetectionLog.fromJson),
    );
    return res.data ?? const [];
  }
}
