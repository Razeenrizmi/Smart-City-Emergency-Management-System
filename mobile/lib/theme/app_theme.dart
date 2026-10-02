import 'package:flutter/material.dart';

class AppPalette {
  static const Color bg = Color(0xFFF5F7FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surface2 = Color(0xFFEEF2F7);
  static const Color border = Color(0xFFDCE3EC);
  static const Color text = Color(0xFF1F2A37);
  static const Color textMuted = Color(0xFF5B6875);
  static const Color online = Color(0xFF16A34A);
  static const Color offline = Color(0xFF94A3B8);
  static const Color danger = Color(0xFFDC2626);
  static const Color error = Color(0xFFDC2626);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFD97706);
  static const Color accent = Color(0xFF0891B2);
  static const Color info = Color(0xFF2563EB);
  static const Color background = Color(0xFFF5F7FA);
}

ThemeData buildAppTheme() {
  final base = ColorScheme.fromSeed(
    seedColor: AppPalette.accent,
    brightness: Brightness.light,
  ).copyWith(
    surface: AppPalette.surface,
    secondary: AppPalette.surface2,
    outline: AppPalette.border,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: AppPalette.bg,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppPalette.surface,
      foregroundColor: AppPalette.text,
      elevation: 0,
      scrolledUnderElevation: 0,
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
      indicatorColor: AppPalette.accent.withValues(alpha: 0.14),
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppPalette.text),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppPalette.surface2,
      side: const BorderSide(color: AppPalette.border),
      labelStyle: const TextStyle(color: AppPalette.text, fontSize: 12),
    ),
    dividerTheme: const DividerThemeData(color: AppPalette.border),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Color(0xFF1F2A37),
      contentTextStyle: TextStyle(color: Colors.white),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
