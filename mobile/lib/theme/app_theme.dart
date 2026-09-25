import 'package:flutter/material.dart';

class AppPalette {
  static const Color bg = Color(0xFF0B1220);
  static const Color surface = Color(0xFF121A2B);
  static const Color surface2 = Color(0xFF18233A);
  static const Color border = Color(0xFF243250);
  static const Color text = Color(0xFFE8EEF9);
  static const Color textMuted = Color(0xFF8B9BB4);
  static const Color online = Color(0xFF22C55E);
  static const Color offline = Color(0xFF64748B);
  static const Color danger = Color(0xFFEF4444);
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color accent = Color(0xFF22D3EE);
  static const Color info = Color(0xFF3B82F6);
  static const Color background = Color(0xFF0B1220);
}

ThemeData buildAppTheme() {
  final base = ColorScheme.fromSeed(
    seedColor: AppPalette.accent,
    brightness: Brightness.dark,
  ).copyWith(
    surface: AppPalette.bg,
    secondary: AppPalette.surface2,
    outline: AppPalette.border,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: AppPalette.bg,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppPalette.bg,
      foregroundColor: AppPalette.text,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: AppPalette.text,
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.4,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppPalette.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppPalette.border),
      ),
      margin: EdgeInsets.zero,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppPalette.surface,
      indicatorColor: AppPalette.accent.withValues(alpha: 0.16),
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppPalette.surface2,
      side: const BorderSide(color: AppPalette.border),
      labelStyle: const TextStyle(color: AppPalette.text, fontSize: 12),
    ),
    dividerTheme: const DividerThemeData(color: AppPalette.border),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppPalette.surface2,
      contentTextStyle: const TextStyle(color: AppPalette.text),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
