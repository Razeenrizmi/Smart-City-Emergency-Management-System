import 'dart:async';

import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/dashboard_stats.dart';
import '../services/dashboard_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'alerts_screen.dart';
import 'cctv_screen.dart';
import 'vehicles_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Timer? _timer;
  DashboardStats? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(AppConfig.pollInterval, (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final stats = await DashboardService.instance.getStatistics();
      if (!mounted) return;
      setState(() {
        _stats = stats;
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
      appBar: AppBar(
        title: const Text('CRIME VEHICLE MONITORING'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => _load(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _stats == null) {
      return const LoadingView(message: 'Connecting to monitoring server...');
    }
    if (_error != null && _stats == null) {
      return ErrorView(message: _error!, onRetry: () => _load());
    }

    final s = _stats ?? DashboardStats.empty();
    final refreshed = _error != null;

    return RefreshIndicator(
      color: AppPalette.accent,
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (refreshed)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppPalette.warning.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppPalette.warning.withValues(alpha: 0.4)),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: AppPalette.warning, fontSize: 13),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  label: 'CCTV Nodes',
                  value: '${s.totalCctvNodes}',
                  icon: Icons.videocam,
                  color: AppPalette.info,
                  onTap: () => _go(const CctvScreen()),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: StatCard(
                  label: 'Online',
                  value: '${s.onlineNodes}',
                  icon: Icons.wifi,
                  color: AppPalette.online,
                  onTap: () => _go(const CctvScreen()),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: StatCard(
                  label: 'Offline',
                  value: '${s.offlineNodes}',
                  icon: Icons.wifi_off,
                  color: AppPalette.offline,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  label: 'Active Vehicles',
                  value: '${s.activeTracks}',
                  icon: Icons.directions_car,
                  color: AppPalette.accent,
                  onTap: () => _go(const VehiclesScreen()),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: StatCard(
                  label: 'Crime Vehicles',
                  value: '${s.crimeVehicles}',
                  icon: Icons.local_police,
                  color: AppPalette.danger,
                  onTap: () => _go(const AlertsScreen()),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: StatCard(
                  label: 'Active Alerts',
                  value: '${s.activeAlerts}',
                  icon: Icons.warning_amber,
                  color: AppPalette.warning,
                  onTap: () => _go(const AlertsScreen()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'AI THROUGHPUT',
                    style: TextStyle(
                      color: AppPalette.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _kv('Target AI FPS', '${s.targetAiFps}'),
                      const SizedBox(width: 20),
                      _kv('Actual AI FPS', s.measuredFpsLabel),
                      const SizedBox(width: 20),
                      _kv(
                        'AI Service',
                        s.aiServiceOnline ? 'ONLINE' : 'OFFLINE',
                        valueColor:
                            s.aiServiceOnline ? AppPalette.online : AppPalette.offline,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Frames processed on the backend at 5 FPS per CCTV node. '
                    'This app only displays measured values.',
                    style: TextStyle(
                      color: AppPalette.textMuted.withValues(alpha: 0.9),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'TODAY',
                    style: TextStyle(
                      color: AppPalette.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 16,
                    runSpacing: 10,
                    children: [
                      _kv('Detections', '${s.detectionsToday}'),
                      _kv('Alerts today', '${s.todayAlerts}'),
                      _kv('Active sessions', '${s.activeSessions}'),
                      _kv('Vehicles today', '${s.vehiclesToday}'),
                    ],
                  ),
                  if (s.generatedAt.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Updated ${s.generatedAt}',
                      style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (s.activeAlerts > 0) ...[
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: AppPalette.danger,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () => _go(const AlertsScreen()),
              icon: const Icon(Icons.notification_important),
              label: Text('View ${s.activeAlerts} active crime alert(s)'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _go(const AlertsScreen()),
              icon: const Icon(Icons.history),
              label: const Text('Open Alert History'),
            ),
          ] else
            OutlinedButton.icon(
              onPressed: () => _go(const AlertsScreen()),
              icon: const Icon(Icons.shield_outlined),
              label: const Text('No active crime alerts — open history'),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _kv(String k, String v, {Color? valueColor}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(k, style: const TextStyle(color: AppPalette.textMuted, fontSize: 11)),
        const SizedBox(height: 2),
        Text(
          v,
          style: TextStyle(
            color: valueColor ?? AppPalette.text,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  void _go(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }
}
