// Basic smoke test for the camera status screen's app shell.

import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/main.dart';

void main() {
  testWidgets('SrmsApp shows the Camera Status app bar', (WidgetTester tester) async {
    await tester.pumpWidget(const SrmsApp());
    await tester.pump();

    expect(find.text('Camera Status'), findsOneWidget);
  });
}
