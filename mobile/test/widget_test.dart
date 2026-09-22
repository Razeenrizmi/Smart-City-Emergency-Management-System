import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('SRMS app renders smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const SRMSApp());
    // Just verify the app builds without crashing
    expect(find.byType(SRMSApp), findsOneWidget);
  });
}
