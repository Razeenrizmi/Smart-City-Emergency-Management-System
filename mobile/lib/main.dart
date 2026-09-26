import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/hazard_detection_screen.dart';

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
      title: 'SRMS — Road Hazard Detector',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0D1117),
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF667EEA),
          secondary: const Color(0xFF764BA2),
          surface: const Color(0xFF161B22),
        ),
        textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
        useMaterial3: true,
      ),
      home: const HazardDetectionScreen(),
    );
  }
}
