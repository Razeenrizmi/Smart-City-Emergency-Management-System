import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/main.dart';
import 'package:mobile/screens/main_shell.dart';
import 'package:mobile/screens/splash_screen.dart';
import 'package:mobile/theme/app_theme.dart';

void main() {
  testWidgets('App opens splash then dashboard shell — no login', (tester) async {
    await tester.pumpWidget(const CrimeVehicleApp());
    await tester.pump();
    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.textContaining('LOGIN', findRichText: true), findsNothing);
    expect(find.textContaining('Sign in', findRichText: true), findsNothing);

    // Advance past splash timer into the main shell (network may fail in tests).
    await tester.pump(const Duration(seconds: 2));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(MainShell), findsOneWidget);
    expect(find.text('Dashboard'), findsWidgets);
  });

  testWidgets('Theme builds with Material 3', (tester) async {
    final theme = buildAppTheme();
    expect(theme.useMaterial3, isTrue);
  });
}
