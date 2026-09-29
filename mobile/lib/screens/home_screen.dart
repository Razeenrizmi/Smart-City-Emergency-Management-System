import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../theme/app_theme.dart';
import 'alerts_screen.dart';
import 'camera_status_screen.dart';
import 'cctv_screen.dart';
import 'create_emergency_screen.dart';
import 'dashboard_screen.dart';
import 'emergency_list_screen.dart';
import 'hazard_detection_screen.dart';
import 'live_camera_screen.dart';
import 'map_screen.dart';
import 'route_list_screen.dart';
import 'vehicles_screen.dart';

/// Unified landing screen — a single hub for every SRMS feature area:
/// Emergency Green Wave, road-hazard detection and crime vehicle surveillance.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  void _open(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('SRMS')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          const _HomeHeader(),
          const SizedBox(height: 22),
          const _SectionLabel('EMERGENCY RESPONSE'),
          const SizedBox(height: 10),
          _ModuleCard(
            icon: Icons.emergency,
            accent: AppPalette.success,
            title: 'Emergency Green Wave',
            subtitle:
                'Preempt traffic signals along a route for an emergency vehicle.',
            actions: [
              _ModuleAction(
                label: 'Select Route',
                icon: Icons.route,
                onPressed: () => _open(context, const RouteListScreen()),
              ),
              _ModuleAction(
                label: 'Create Emergency',
                icon: Icons.emergency,
                onPressed: () => _open(context, const CreateEmergencyScreen()),
              ),
              _ModuleAction(
                label: 'View Created Emergencies',
                icon: Icons.list_alt,
                onPressed: () => _open(context, const EmergencyListScreen()),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _ModuleCard(
            icon: Icons.warning_amber_rounded,
            accent: AppPalette.warning,
            title: 'Road Hazard Detection',
            subtitle:
                'Detect potholes from accelerometer spikes and verify them with AI.',
            actions: [
              _ModuleAction(
                label: 'Start Hazard Detection',
                icon: Icons.sensors_rounded,
                onPressed: () => _open(context, const HazardDetectionScreen()),
              ),
            ],
          ),
          const SizedBox(height: 22),
          const _SectionLabel('TRAFFIC SIGNAL CONTROL'),
          const SizedBox(height: 10),
          _ModuleCard(
            icon: Icons.traffic,
            accent: AppPalette.accent,
            title: 'Junction Camera Status',
            subtitle:
                'Live per-junction camera density, read from the signal-control backend, with per-road fault reporting.',
            actions: [
              _ModuleAction(
                label: 'Camera Status',
                icon: Icons.videocam_outlined,
                onPressed: () => _open(context, const CameraStatusScreen()),
              ),
            ],
          ),
          const SizedBox(height: 22),
          const _SectionLabel('CRIME VEHICLE DETECTION'),
          const SizedBox(height: 10),
          _ModuleCard(
            icon: Icons.local_police,
            accent: AppPalette.accent,
            title: 'Crime Vehicle Detection',
            subtitle:
                'Multi-CCTV number-plate recognition, wanted hotlist and intercept dispatch.',
            actions: [
              _ModuleAction(
                label: 'Live Camera Monitor',
                icon: Icons.video_camera_front,
                onPressed: () => _open(context, const LiveCameraScreen()),
              ),
              _ModuleAction(
                label: 'CCTV Nodes',
                icon: Icons.videocam,
                onPressed: () => _open(context, const CctvScreen()),
              ),
              _ModuleAction(
                label: 'Wanted Hotlist',
                icon: Icons.shield_outlined,
                onPressed: () => _open(context, const VehiclesScreen()),
              ),
              _ModuleAction(
                label: 'Crime Alerts',
                icon: Icons.notification_important,
                onPressed: () => _open(context, const AlertsScreen()),
              ),
              _ModuleAction(
                label: 'Camera Map',
                icon: Icons.map,
                onPressed: () => _open(context, const MapScreen()),
              ),
              _ModuleAction(
                label: 'Crime Dashboard',
                icon: Icons.dashboard,
                onPressed: () => _open(context, const DashboardScreen()),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Center(
            child: Text(
              'API: ${AppConfig.apiBaseUrl}',
              style: const TextStyle(color: AppPalette.textMuted, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppPalette.accent.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppPalette.accent.withValues(alpha: 0.5)),
          ),
          child: const Icon(Icons.location_city_rounded,
              color: AppPalette.accent, size: 28),
        ),
        const SizedBox(width: 14),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SRMS',
                style: TextStyle(
                  color: AppPalette.text,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
              Text(
                'Smart City Emergency Management',
                style: TextStyle(color: AppPalette.textMuted, fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: AppPalette.textMuted,
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  final IconData icon;
  final Color accent;
  final String title;
  final String subtitle;
  final List<Widget> actions;

  const _ModuleCard({
    required this.icon,
    required this.accent,
    required this.title,
    required this.subtitle,
    required this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: accent, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: AppPalette.text,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              subtitle,
              style: const TextStyle(
                color: AppPalette.textMuted,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 14),
            ...actions,
          ],
        ),
      ),
    );
  }
}

class _ModuleAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  const _ModuleAction({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: 18),
          label: Align(
            alignment: Alignment.centerLeft,
            child: Text(label),
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppPalette.text,
            side: const BorderSide(color: AppPalette.border),
            padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
    );
  }
}
