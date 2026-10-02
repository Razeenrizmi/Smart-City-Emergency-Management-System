import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

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

/// Unified landing screen — a cinematic command-centre hub for every SRMS
/// feature area: Emergency Green Wave, road-hazard detection and crime
/// vehicle surveillance.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with TickerProviderStateMixin {
  late final AnimationController _intro;
  late final AnimationController _ambient;

  @override
  void initState() {
    super.initState();
    _intro = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _ambient = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();
  }

  @override
  void dispose() {
    _intro.dispose();
    _ambient.dispose();
    super.dispose();
  }

  void _open(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final entrance = CurvedAnimation(parent: _intro, curve: Curves.easeOutCubic);

    return Scaffold(
      backgroundColor: AppPalette.bg,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _HeroHeader(animation: _ambient),
          FadeTransition(
            opacity: entrance,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 0.06),
                end: Offset.zero,
              ).animate(entrance),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 26, 16, 30),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionLabel('EMERGENCY RESPONSE', AppPalette.success),
                    const SizedBox(height: 12),
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
                          accent: AppPalette.success,
                          primary: true,
                          onPressed: () => _open(context, const RouteListScreen()),
                        ),
                        _ModuleAction(
                          label: 'Create Emergency',
                          icon: Icons.emergency,
                          accent: AppPalette.success,
                          onPressed: () =>
                              _open(context, const CreateEmergencyScreen()),
                        ),
                        _ModuleAction(
                          label: 'View Created Emergencies',
                          icon: Icons.list_alt,
                          accent: AppPalette.success,
                          onPressed: () =>
                              _open(context, const EmergencyListScreen()),
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
                          accent: AppPalette.warning,
                          primary: true,
                          onPressed: () =>
                              _open(context, const HazardDetectionScreen()),
                        ),
                      ],
                    ),
                    const SizedBox(height: 26),
                    const _SectionLabel('TRAFFIC SIGNAL CONTROL', AppPalette.accent),
                    const SizedBox(height: 12),
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
                          accent: AppPalette.accent,
                          primary: true,
                          onPressed: () =>
                              _open(context, const CameraStatusScreen()),
                        ),
                      ],
                    ),
                    const SizedBox(height: 26),
                    const _SectionLabel('CRIME VEHICLE DETECTION', AppPalette.danger),
                    const SizedBox(height: 12),
                    _ModuleCard(
                      icon: Icons.local_police,
                      accent: AppPalette.danger,
                      title: 'Crime Vehicle Detection',
                      subtitle:
                          'Multi-CCTV number-plate recognition, wanted hotlist and intercept dispatch.',
                      actions: [
                        _ModuleAction(
                          label: 'Live Camera Monitor',
                          icon: Icons.video_camera_front,
                          accent: AppPalette.danger,
                          primary: true,
                          onPressed: () =>
                              _open(context, const LiveCameraScreen()),
                        ),
                        _ModuleAction(
                          label: 'CCTV Nodes',
                          icon: Icons.videocam,
                          accent: AppPalette.danger,
                          onPressed: () => _open(context, const CctvScreen()),
                        ),
                        _ModuleAction(
                          label: 'Wanted Hotlist',
                          icon: Icons.shield_outlined,
                          accent: AppPalette.danger,
                          onPressed: () => _open(context, const VehiclesScreen()),
                        ),
                        _ModuleAction(
                          label: 'Crime Alerts',
                          icon: Icons.notification_important,
                          accent: AppPalette.danger,
                          onPressed: () => _open(context, const AlertsScreen()),
                        ),
                        _ModuleAction(
                          label: 'Camera Map',
                          icon: Icons.map,
                          accent: AppPalette.danger,
                          onPressed: () => _open(context, const MapScreen()),
                        ),
                        _ModuleAction(
                          label: 'Crime Dashboard',
                          icon: Icons.dashboard,
                          accent: AppPalette.danger,
                          onPressed: () =>
                              _open(context, const DashboardScreen()),
                        ),
                      ],
                    ),
                    const SizedBox(height: 26),
                    Center(
                      child: Text(
                        'API: ${AppConfig.apiBaseUrl}',
                        style: GoogleFonts.outfit(
                          color: AppPalette.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-bleed gradient hero with drifting glow orbs and display typography.
class _HeroHeader extends StatelessWidget {
  final Animation<double> animation;
  const _HeroHeader({required this.animation});

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
      child: Stack(
        children: [
          Positioned.fill(
            child: AnimatedBuilder(
              animation: animation,
              builder: (context, _) {
                final t = animation.value * 2 * math.pi;
                return DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFE7EAFB), Color(0xFFF2F5FA)],
                    ),
                  ),
                  child: Stack(
                    children: [
                      _orb(
                        size: 240,
                        color: const Color(0xFF667EEA),
                        alignment: Alignment(-0.9 + 0.15 * math.sin(t), -0.9),
                      ),
                      _orb(
                        size: 260,
                        color: AppPalette.accent,
                        alignment: Alignment(0.95, 0.5 + 0.2 * math.cos(t)),
                      ),
                      _orb(
                        size: 180,
                        color: AppPalette.success,
                        alignment: Alignment(-0.4, 1.1),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(20, topInset + 22, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(15),
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF667EEA).withValues(alpha: 0.4),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.location_city_rounded,
                          color: Colors.white, size: 24),
                    ),
                    const Spacer(),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppPalette.success.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: AppPalette.success.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: AppPalette.success,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: AppPalette.success.withValues(alpha: 0.7),
                                  blurRadius: 6,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'SYSTEM ONLINE',
                            style: GoogleFonts.outfit(
                              color: AppPalette.success,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 30),
                ShaderMask(
                  shaderCallback: (bounds) => const LinearGradient(
                    colors: [Color(0xFF0B1220), Color(0xFF4F46E5)],
                  ).createShader(bounds),
                  child: Text(
                    'COMMAND\nCENTRE',
                    style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontSize: 38,
                      height: 0.98,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Smart City Emergency Management',
                  style: GoogleFonts.outfit(
                    color: AppPalette.textMuted,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Emergency response · Hazard intelligence · Traffic surveillance',
                  style: GoogleFonts.outfit(
                    color: AppPalette.textMuted,
                    fontSize: 11.5,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _orb({
    required double size,
    required Color color,
    required Alignment alignment,
  }) {
    return Align(
      alignment: alignment,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: 0.18),
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  final Color accent;
  const _SectionLabel(this.text, this.accent);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 16,
          decoration: BoxDecoration(
            color: accent,
            borderRadius: BorderRadius.circular(2),
            boxShadow: [
              BoxShadow(color: accent.withValues(alpha: 0.4), blurRadius: 8),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Text(
          text,
          style: GoogleFonts.outfit(
            color: AppPalette.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.6,
          ),
        ),
      ],
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
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: 0.06),
            AppPalette.surface,
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0B1220).withValues(alpha: 0.06),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(11),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: accent.withValues(alpha: 0.14),
                    border: Border.all(color: accent.withValues(alpha: 0.42)),
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.18),
                        blurRadius: 16,
                      ),
                    ],
                  ),
                  child: Icon(icon, color: accent, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    title,
                    style: GoogleFonts.outfit(
                      color: AppPalette.text,
                      fontSize: 17.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.1,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              subtitle,
              style: GoogleFonts.outfit(
                color: AppPalette.textMuted,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 16),
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
  final Color accent;
  final bool primary;
  final VoidCallback onPressed;

  const _ModuleAction({
    required this.label,
    required this.icon,
    required this.accent,
    required this.onPressed,
    this.primary = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onPressed,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: primary
                  ? accent.withValues(alpha: 0.12)
                  : AppPalette.surface2,
              border: Border.all(
                color: primary
                    ? accent.withValues(alpha: 0.5)
                    : AppPalette.border,
              ),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: primary ? accent : AppPalette.text),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: GoogleFonts.outfit(
                      color: AppPalette.text,
                      fontSize: 13.5,
                      fontWeight: primary ? FontWeight.w700 : FontWeight.w600,
                    ),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 13,
                  color: primary ? accent : AppPalette.textMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
