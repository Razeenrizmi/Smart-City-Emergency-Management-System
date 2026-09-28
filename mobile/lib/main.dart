import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'config/api_config.dart';
import 'screens/create_emergency_screen.dart';
import 'screens/emergency_list_screen.dart';
import 'screens/hazard_detection_screen.dart';
import 'screens/route_list_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const SRMSApp());
}

class SRMSApp extends StatelessWidget {
  const SRMSApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SRMS — Smart City Emergency',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

/// Unified entry point that links the two field features of the SRMS platform:
/// road hazard detection and the Emergency Green Wave signal preemption flow.
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  void _open(BuildContext context, Widget page) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => page));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _HomeHeader(),
              const SizedBox(height: 24),
              _ModuleCard(
                icon: Icons.emergency,
                accent: const Color(0xFF38A169),
                title: 'Emergency Green Wave',
                subtitle: 'Preempt traffic signals along a route for an emergency vehicle.',
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
              const SizedBox(height: 16),
              _ModuleCard(
                icon: Icons.warning_amber_rounded,
                accent: const Color(0xFF667EEA),
                title: 'Road Hazard Detection',
                subtitle: 'Detect potholes from accelerometer spikes and verify them with AI.',
                actions: [
                  _ModuleAction(
                    label: 'Start Hazard Detection',
                    icon: Icons.sensors_rounded,
                    onPressed: () => _open(context, const HazardDetectionScreen()),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Center(
                child: Text(
                  'API: ${ApiConfig.baseUrl}',
                  style: GoogleFonts.outfit(
                    color: const Color(0xFF4A5568),
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
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
            gradient: const LinearGradient(
              colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.location_city_rounded, color: Colors.white, size: 28),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SRMS',
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                'Smart City Emergency Management',
                style: GoogleFonts.outfit(
                  color: const Color(0xFF8B949E),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({
    required this.icon,
    required this.accent,
    required this.title,
    required this.subtitle,
    required this.actions,
  });

  final IconData icon;
  final Color accent;
  final String title;
  final String subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
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
                  style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            subtitle,
            style: GoogleFonts.outfit(
              color: const Color(0xFF8B949E),
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          ...actions,
        ],
      ),
    );
  }
}

class _ModuleAction extends StatelessWidget {
  const _ModuleAction({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: 18),
          label: Text(
            label,
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFFE2E8F0),
            side: const BorderSide(color: Color(0xFF30363D)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
    );
  }
}
