import 'package:flutter/material.dart';

import '../models/detection_log.dart';
import '../services/detection_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

/// Full alert / detection detail from `GET /api/crime-vehicle/logs/{logId}`.
class AlertDetailScreen extends StatefulWidget {
  final String? logId;
  final DetectionLog? initial;

  const AlertDetailScreen({super.key, this.logId, this.initial});

  @override
  State<AlertDetailScreen> createState() => _AlertDetailScreenState();
}

class _AlertDetailScreenState extends State<AlertDetailScreen> {
  DetectionLog? _log;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _log = widget.initial;
    _load();
  }

  Future<void> _load() async {
    if (widget.logId == null) {
      setState(() {
        _loading = false;
        _error = widget.initial == null ? 'No alert selected.' : null;
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final log = await DetectionService.instance.getLog(widget.logId!);
      if (!mounted) return;
      setState(() {
        _log = log;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ALERT DETAILS')),
      body: _body(),
    );
  }

  Widget _body() {
    if (_loading) return const LoadingView(message: 'Loading alert...');
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    final log = _log;
    if (log == null) return const EmptyView(message: 'Alert not found.');

    final hasImage = log.snapshot.isNotEmpty &&
        (log.snapshot.startsWith('http') || log.snapshot.startsWith('data:image'));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (log.isCrimeVehicle || log.isActiveAlert)
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppPalette.danger.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppPalette.danger.withValues(alpha: 0.45)),
            ),
            child: Row(
              children: const [
                Icon(Icons.warning_amber, color: AppPalette.danger),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'CRIME VEHICLE MATCH',
                    style: TextStyle(
                      color: AppPalette.danger,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
              ],
            ),
          ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _row('Alert ID', log.logId),
                _row('Node ID', '${log.nodeId} (${log.nodeLabel})'),
                _row('Vehicle Track ID', log.trackId?.toString() ?? '—'),
                _row('Vehicle Type', log.vehicleType.isEmpty ? '—' : log.vehicleType),
                _row('License Plate', log.plateNumber.isEmpty ? '—' : log.plateNumber),
                _row(
                  'Detection Confidence',
                  log.vehicleConfidence > 0
                      ? '${(log.vehicleConfidence * 100).toStringAsFixed(1)}%'
                      : (log.confidence > 0 ? '${log.confidence.toStringAsFixed(1)}%' : '—'),
                ),
                _row(
                  'OCR Confidence',
                  log.ocrConfidence > 0
                      ? '${(log.ocrConfidence * 100).toStringAsFixed(1)}%'
                      : '—',
                ),
                _row('Crime Match', log.crimeMatch ? 'YES' : 'NO'),
                _row('Hotlist Match', log.isHotlistMatch ? 'YES' : 'NO'),
                _row('Status', log.status),
                _row('Timestamp', log.timestamp),
                _row('Location', log.location.isEmpty ? '—' : log.location),
                _row('Camera', log.cameraName.isEmpty ? '—' : log.cameraName),
                _row('Session', log.sessionId.isEmpty ? '—' : log.sessionId),
                if (log.threatLevel.isNotEmpty) _row('Threat Level', log.threatLevel),
                if (log.vehicleDetails.isNotEmpty)
                  _row('Vehicle Details', log.vehicleDetails),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'EVIDENCE IMAGE',
          style: TextStyle(
            color: AppPalette.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 8),
        if (hasImage)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              log.snapshot,
              height: 200,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const _NoEvidence(
                'Evidence URL could not be loaded from this device.',
              ),
            ),
          )
        else
          const _NoEvidence(
            'No evidence image stored for this detection.\n'
            'The backend Snapshot field is empty — nothing is fabricated.',
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(
              k,
              style: const TextStyle(color: AppPalette.textMuted, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              v,
              style: const TextStyle(
                color: AppPalette.text,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NoEvidence extends StatelessWidget {
  final String message;
  const _NoEvidence(this.message);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppPalette.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppPalette.border),
      ),
      alignment: Alignment.center,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppPalette.textMuted, fontSize: 12, height: 1.4),
        ),
      ),
    );
  }
}
