import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'config/app_config.dart';
import 'screens/main_shell.dart';
import 'screens/splash_screen.dart';
import 'services/dashboard_service.dart';
import 'theme/app_theme.dart';

/// SRMS — Smart City Emergency Management mobile client.
///
/// One shell exposes both feature domains of the platform:
///   • Emergency Green Wave + road-hazard detection (emergency response)
///   • Crime Vehicle Detection / multi-CCTV ANPR surveillance
///
/// NO login / register / JWT / logout. Opens splash → unified shell.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const SRMSApp());
}

class SRMSApp extends StatelessWidget {
  const SRMSApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const _StartupGate(),
    );
  }
}

/// Probes the monitoring backend once, then hands off to the unified shell.
class _StartupGate extends StatefulWidget {
  const _StartupGate();

  @override
  State<_StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<_StartupGate> {
  bool _ready = false;
  bool _connected = false;
  String? _error;
  bool _entered = false;

  @override
  void initState() {
    super.initState();
    _probe();
  }

  Future<void> _probe() async {
    setState(() {
      _ready = false;
      _error = null;
      _connected = false;
    });
    try {
      await DashboardService.instance.getStatistics();
      if (!mounted) return;
      setState(() {
        _connected = true;
        _ready = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _connected = false;
        _error = 'Unable to reach the monitoring server.\n'
            'Set API_BASE_URL with --dart-define for your machine LAN IP.';
        _ready = true;
      });
    }
  }

  void _enter() {
    if (_entered) return;
    _entered = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const MainShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SplashScreen(
      connected: _connected,
      error: _ready ? _error : null,
      onContinue: _enter,
    );
  }
}
