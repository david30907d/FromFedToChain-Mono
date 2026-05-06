import 'package:ai_podcast_mobile/widgets/played_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PlayedButton', () {
    testWidgets('shows "Played" when listened is true', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlayedButton(
              listened: true,
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.text('Played'), findsOneWidget);
    });

    testWidgets('shows "Mark played" when listened is false', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlayedButton(
              listened: false,
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.text('Mark played'), findsOneWidget);
    });

    testWidgets('calls onPressed when tapped', (tester) async {
      bool pressed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlayedButton(
              listened: false,
              onPressed: () => pressed = true,
            ),
          ),
        ),
      );

      await tester.tap(find.text('Mark played'));
      expect(pressed, isTrue);
    });

    testWidgets('shows filled check icon when listened', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlayedButton(
              listened: true,
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    });

    testWidgets('shows outline icon when not listened', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlayedButton(
              listened: false,
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
    });
  });
}
