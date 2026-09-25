import 'dart:async';

import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/detection_log.dart';
import '../services/detection_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'alert_detail_screen.dart';

/// Crime vehicle alerts + history (paginated against the backend).
class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  Timer? _timer;
  final List<DetectionLog> _active = [];
  final List<DetectionLog> _history = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _error;
  int _historyOffset = 0;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _timer = Timer.periodic(
      AppConfig.pollInterval,
      (_) => _load(reset: true, silent: true),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool reset = false, bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final active = await DetectionService.instance.getActiveAlerts(limit: 50);
      if (reset || _history.isEmpty) {
        final page = await DetectionService.instance.getHistory(
          limit: AppConfig.historyPageSize,
          offset: 0,
        );
        if (!mounted) return;
        setState(() {
          _active
            ..clear()
            ..addAll(active);
          _history
            ..clear()
            ..addAll(page);
          _historyOffset = page.length;
          _hasMore = page.length >= AppConfig.historyPageSize;
          _error = null;
          _loading = false;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _active
            ..clear()
            ..addAll(active);
          _error = null;
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    try {
      final page = await DetectionService.instance.getHistory(
        limit: AppConfig.historyPageSize,
        offset: _historyOffset,
      );
      if (!mounted) return;
      setState(() {
        _history.addAll(page);
        _historyOffset += page.length;
        _hasMore = page.length >= AppConfig.historyPageSize;
        _loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loadingMore = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CRIME ALERTS'),
        actions: [
          IconButton(onPressed: () => _load(reset: true), icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _body(),
    );
  }

  Widget _body() {
    if (_loading && _active.isEmpty && _history.isEmpty) {
      return const LoadingView(message: 'Loading alerts...');
    }
    if (_error != null && _active.isEmpty && _history.isEmpty) {
      return ErrorView(message: _error!, onRetry: () => _load(reset: true));
    }

    return RefreshIndicator(
      color: AppPalette.accent,
      onRefresh: () => _load(reset: true),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Icon(Icons.notification_important, color: AppPalette.danger, size: 18),
              const SizedBox(width: 8),
              Text(
                'ACTIVE ALERTS (${_active.length})',
                style: const TextStyle(
                  color: AppPalette.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_active.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'No active crime vehicle alerts.',
                  style: TextStyle(color: AppPalette.textMuted),
                ),
              ),
            )
          else
            ..._active.map(_activeTile),
          const SizedBox(height: 20),
          Row(
            children: [
              const Icon(Icons.history, color: AppPalette.accent, size: 18),
              const SizedBox(width: 8),
              Text(
                'ALERT HISTORY (${_history.length}${_hasMore ? '+' : ''})',
                style: const TextStyle(
                  color: AppPalette.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_history.isEmpty)
            const EmptyView(message: 'No detection history yet.', icon: Icons.history)
          else
            ..._history.map(_historyTile),
          if (_loadingMore)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator(color: AppPalette.accent)),
            )
          else if (_hasMore)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton(
                onPressed: _loadMore,
                child: const Text('Load more'),
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _activeTile(DetectionLog log) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: AppPalette.danger.withValues(alpha: 0.08),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => AlertDetailScreen(logId: log.logId)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  StatusChip.alert(label: 'CRIME VEHICLE DETECTED'),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                log.plateNumber.isEmpty ? 'Unknown plate' : log.plateNumber,
                style: const TextStyle(
                  color: AppPalette.text,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              _kv('Vehicle', log.vehicleType.isEmpty ? '—' : log.vehicleType),
              _kv('Node', log.nodeLabel),
              _kv('Location', log.location.isEmpty ? '—' : log.location),
              _kv(
                'Confidence',
                log.vehicleConfidence > 0
                    ? '${(log.vehicleConfidence * 100).toStringAsFixed(0)}%'
                    : '—',
              ),
              _kv('Time', log.timestamp),
            ],
          ),
        ),
      ),
    );
  }

  Widget _historyTile(DetectionLog log) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => AlertDetailScreen(logId: log.logId)),
        ),
        leading: Icon(
          log.isCrimeVehicle ? Icons.local_police : Icons.directions_car,
          color: log.isCrimeVehicle ? AppPalette.danger : AppPalette.accent,
        ),
        title: Text(
          log.plateNumber.isEmpty ? log.logId : log.plateNumber,
          style: const TextStyle(color: AppPalette.text, fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '${log.datePart} ${log.timePart} · ${log.nodeLabel} · '
          'Track ${log.trackId ?? '—'} · ${log.vehicleType.isEmpty ? '—' : log.vehicleType}',
          style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
        ),
        trailing: Text(
          log.status.replaceAll('_', ' '),
          textAlign: TextAlign.right,
          style: TextStyle(
            color: log.isActiveAlert
                ? AppPalette.warning
                : log.isCrimeVehicle
                    ? AppPalette.danger
                    : AppPalette.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(k, style: const TextStyle(color: AppPalette.textMuted, fontSize: 12)),
          ),
          Expanded(
            child: Text(
              v,
              style: const TextStyle(color: AppPalette.text, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
