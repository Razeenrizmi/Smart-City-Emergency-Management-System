import '../models/api_response.dart';
import '../models/cctv_node.dart';
import 'api_client.dart';

class CctvService {
  CctvService._();
  static final CctvService instance = CctvService._();

  final ApiClient _api = ApiClient.instance;

  Future<List<CctvNode>> getNodes() async {
    final res = await _api.get(
      '/cctv/nodes',
      decode: (raw) => _api.decodeList(raw, CctvNode.fromJson),
    );
    return res.data ?? const [];
  }

  Future<CctvNode> getNode(int nodeId) async {
    final res = await _api.get(
      '/cctv/nodes/$nodeId',
      decode: (raw) => CctvNode.fromJson(
        (raw as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
    if (res.data == null) {
      throw ApiException('CCTV node $nodeId not found.');
    }
    return res.data!;
  }

  /// `POST /api/cctv/nodes/{id}/start` → backend-issued `NODE{n}-SESSION-{seq}`.
  Future<String> startNodeSession(int nodeId) async {
    final res = await _api.postJson(
      '/cctv/nodes/$nodeId/start',
      decode: (raw) => (raw as Map?)?.cast<String, dynamic>() ?? const {},
    );
    final sessionId = res.data?['sessionId'] as String?;
    if (sessionId == null || sessionId.isEmpty) {
      throw ApiException('Backend did not return a session id.');
    }
    return sessionId;
  }

  /// `POST /api/cctv/nodes/{id}/stop` — ends sessions and marks node OFFLINE.
  Future<void> stopNode(int nodeId) async {
    await _api.postJson(
      '/cctv/nodes/$nodeId/stop',
      decode: (raw) => raw,
    );
  }

  /// `PUT /api/cctv/nodes/{id}/status` — ONLINE | OFFLINE | ANALYZING | ERROR | CONNECTING.
  Future<void> setNodeStatus(int nodeId, String status) async {
    await _api.putJson(
      '/cctv/nodes/$nodeId/status',
      body: {'status': status},
      decode: (raw) => raw,
    );
  }
}
