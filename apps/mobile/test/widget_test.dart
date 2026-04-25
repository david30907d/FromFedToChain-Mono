import 'package:flutter_test/flutter_test.dart';

import 'package:ai_podcast_mobile/main.dart';

void main() {
  testWidgets('shows app title', (tester) async {
    await tester.pumpWidget(const AiPodcastApp());

    await tester.pump();
    expect(find.text('AI Podcast'), findsOneWidget);
  });
}
