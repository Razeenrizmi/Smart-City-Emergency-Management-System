import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  final bool connected;
  final String? error;
  final VoidCallback onContinue;

  const SplashScreen({
    super.key,
    required this.connected,
    required this.error,
    required this.onContinue,
  });

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    Future.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) widget.onContinue();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppPalette.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ScaleTransition(
                scale: CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
                child: Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: AppPalette.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppPalette.accent.withValues(alpha: 0.5)),
                  ),
                  child: const Icon(Icons.videocam, size: 44, color: AppPalette.accent),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'CRIME VEHICLE DETECTION',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppPalette.text,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Security Monitoring Client',
                style: TextStyle(color: AppPalette.textMuted, fontSize: 13),
              ),
              const SizedBox(height: 32),
              if (widget.error == null)
                const CircularProgressIndicator(color: AppPalette.accent)
              else ...[
                const Icon(Icons.cloud_off, color: AppPalette.warning, size: 36),
                const SizedBox(height: 12),
                Text(
                  widget.error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppPalette.textMuted, fontSize: 13),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: widget.onContinue,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Continue offline'),
                ),
              ],
              const Spacer(),
              const Text(
                'No login required — opens to dashboard',
                style: TextStyle(color: AppPalette.textMuted, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
