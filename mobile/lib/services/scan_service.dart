import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../models/api_response.dart';
import '../models/scan_result.dart';
import 'api_client.dart';

/// Frame scanning against the existing ASP.NET pipeline
/// (`POST /api/crime-vehicle/scan`, `POST /api/crime-vehicle/session/end`).
/// Same endpoints the web LiveANPRMonitor calls — no second backend.
class ScanService {
  ScanService._();
  static final ScanService instance = ScanService._();

  final ApiClient _api = ApiClient.instance;

  /// One camera frame → YOLO/ByteTrack/OCR pipeline.
  Future<ScanResult> scanFrame({
    required Uint8List jpegBytes,
    required int nodeId,
    String sessionId = '',
  }) async {
    final res = await _api.postMultipart(
      '/crime-vehicle/scan',
      fields: {
        if (sessionId.isNotEmpty) 'sessionId': sessionId,
        'nodeId': '$nodeId',
      },
      files: [
        http.MultipartFile.fromBytes(
          'image',
          jpegBytes,
          filename: 'cctv-frame.jpg',
        ),
      ],
      decode: (raw) => ScanResult.fromJson(
        (raw as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
    if (res.data == null) {
      throw const ApiException('Scan returned an empty response.');
    }
    return res.data!;
  }

  /// `POST /api/crime-vehicle/session/end` (form field `sessionId`).
  Future<void> endSession(String sessionId) async {
    if (sessionId.isEmpty) return;
    try {
      await _api.postForm(
        '/crime-vehicle/session/end',
        fields: {'sessionId': sessionId},
        decode: (raw) => raw,
      );
    } on ApiException {
      // Best-effort cleanup — backend also ends dangling sessions on next start.
    }
  }
}
