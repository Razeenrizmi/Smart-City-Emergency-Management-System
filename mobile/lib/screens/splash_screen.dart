import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme/app_theme.dart';

/// Cinematic launch screen — animated gradient hero with a drifting glow,
/// gradient display type and a live connection status read-out.
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
    with TickerProviderStateMixin {
  late final AnimationController _intro;
  late final AnimationController _ambient;

  @override
  void initState() {
    super.initState();
    _intro = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    _ambient = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 9),
    )..repeat();
    Future.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) widget.onContinue();
    });
  }

  @override
  void dispose() {
    _intro.dispose();
    _ambient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entrance = CurvedAnimation(parent: _intro, curve: Curves.easeOutCubic);

    return Scaffold(
      backgroundColor: AppPalette.bg,
      body: Stack(
        children: [
          Positioned.fill(child: _AmbientBackdrop(animation: _ambient)),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: FadeTransition(
                opacity: entrance,
                child: Column(
                  children: [
                    const Spacer(),
                    SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, 0.18),
                        end: Offset.zero,
                      ).animate(entrance),
                      child: _BrandBlock(),
                    ),
                    const SizedBox(height: 30),
                    _StatusBlock(
                      connected: widget.connected,
                      error: widget.error,
                      onContinue: widget.onContinue,
                    ),
                    const Spacer(),
                    const Text(
                      'No login required — opens to dashboard',
                      style: TextStyle(color: AppPalette.textMuted, fontSize: 11),
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

class _AmbientBackdrop extends StatelessWidget {
  final Animation<double> animation;
  const _AmbientBackdrop({required this.animation});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final t = animation.value * 2 * math.pi;
        return DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFFFFFFF), Color(0xFFF5F7FA), Color(0xFFEEF2F7)],
            ),
          ),
          child: Stack(
            children: [
              _glow(
                size: 320,
                color: AppPalette.accent,
                align: Alignment(-0.8 + 0.12 * math.sin(t), -0.9),
                opacity: 0.20,
              ),
              _glow(
                size: 360,
                color: const Color(0xFF6D5CFF),
                align: Alignment(0.9, 0.75 + 0.1 * math.cos(t)),
                opacity: 0.16,
              ),
              _glow(
                size: 240,
                color: const Color(0xFF22C55E),
                align: Alignment(0.6 * math.cos(t), 0.9),
                opacity: 0.10,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _glow({
    required double size,
    required Color color,
    required Alignment align,
    required double opacity,
  }) {
    return Align(
      alignment: align,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: opacity),
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}

class _BrandBlock extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF667EEA).withValues(alpha: 0.4),
                blurRadius: 36,
                spreadRadius: 2,
              ),
            ],
          ),
          child: const Icon(Icons.location_city_rounded,
              size: 46, color: Colors.white),
        ),
        const SizedBox(height: 26),
        ShaderMask(
          shaderCallback: (bounds) => const LinearGradient(
            colors: [Color(0xFF0B1220), Color(0xFF4F46E5)],
          ).createShader(bounds),
          child: Text(
            'SRMS',
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 46,
              fontWeight: FontWeight.w800,
              letterSpacing: 8,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'SMART CITY EMERGENCY MANAGEMENT',
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(
            color: AppPalette.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 2.4,
          ),
        ),
      ],
    );
  }
}

class _StatusBlock extends StatelessWidget {
  final bool connected;
  final String? error;
  final VoidCallback onContinue;

  const _StatusBlock({
    required this.connected,
    required this.error,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    if (error == null) {
      return Column(
        children: [
          const SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(
              color: AppPalette.accent,
              strokeWidth: 2.4,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            connected ? 'Systems online' : 'Establishing secure link…',
            style: GoogleFonts.outfit(
              color: AppPalette.textMuted,
              fontSize: 13,
              letterSpacing: 0.4,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        const Icon(Icons.cloud_off_rounded, color: AppPalette.warning, size: 34),
        const SizedBox(height: 12),
        Text(
          error!,
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(
            color: AppPalette.textMuted,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: onContinue,
          icon: const Icon(Icons.refresh, size: 18),
          label: Text('Continue offline', style: GoogleFonts.outfit()),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppPalette.text,
            side: const BorderSide(color: AppPalette.border),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ],
    );
  }
}
