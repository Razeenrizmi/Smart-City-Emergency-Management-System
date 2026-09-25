/// `GET /api/cctv/nodes` → `CctvNode`
class CctvNode {
  final int id;
  final int nodeId;
  final String cameraName;
  final String location;
  final String cameraType;
  final String status;
  final String streamSource;
  final String streamUrl;
  final String createdAt;
  final String lastSeenAt;
  final double? lat;
  final double? lng;

  const CctvNode({
    required this.id,
    required this.nodeId,
    required this.cameraName,
    required this.location,
    required this.cameraType,
    required this.status,
    required this.streamSource,
    required this.streamUrl,
    required this.createdAt,
    required this.lastSeenAt,
    this.lat,
    this.lng,
  });

  bool get isOnline => status.toUpperCase() == 'ONLINE';

  String get nodeLabel {
    final n = nodeId.toString().padLeft(3, '0');
    return 'NODE-$n';
  }

  factory CctvNode.fromJson(Map<String, dynamic> json) {
    return CctvNode(
      id: (json['id'] as num?)?.toInt() ?? 0,
      nodeId: (json['nodeId'] as num?)?.toInt() ?? 0,
      cameraName: (json['cameraName'] as String?) ?? '',
      location: (json['location'] as String?) ?? '',
      cameraType: (json['cameraType'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'OFFLINE',
      streamSource: (json['streamSource'] as String?) ?? '',
      streamUrl: (json['streamUrl'] as String?) ?? '',
      createdAt: (json['createdAt'] as String?) ?? '',
      lastSeenAt: (json['lastSeenAt'] as String?) ?? 'Never',
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
    );
  }
}
