import 'package:flutter/material.dart';
import 'screens/camera_status_screen.dart';

void main() {
  runApp(const SrmsApp());
}

class SrmsApp extends StatelessWidget {
  const SrmsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SRMS Traffic Inspector',
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple)),
      home: const CameraStatusScreen(),
    );
  }
}
