import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ai_podcast_mobile/main.dart';

void main() {
  testWidgets('shows branded auth gate', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const AiPodcastApp(supabaseConfigured: false));

    await tester.pump();
    expect(find.text('From Fed to Chain'), findsWidgets);
    expect(find.byIcon(Icons.graphic_eq_rounded), findsOneWidget);
  });
}
