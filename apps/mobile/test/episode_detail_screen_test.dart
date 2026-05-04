import 'package:ai_podcast_mobile/models/episode.dart';
import 'package:ai_podcast_mobile/screens/episode_detail_screen.dart';
import 'package:ai_podcast_mobile/state/auth_provider.dart';
import 'package:ai_podcast_mobile/state/likes_provider.dart';
import 'package:ai_podcast_mobile/state/playback_provider.dart';
import 'package:ai_podcast_mobile/theme/app_theme.dart';
import 'package:ai_podcast_mobile/widgets/episode_card.dart';
import 'package:ai_podcast_mobile/widgets/hero_episode_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('EpisodeCard opens the detail screen with transcript',
      (tester) async {
    final episode = _episode(script: 'Full transcript body.');

    await _pumpHarness(
      tester,
      EpisodeCard(
        episode: episode,
        isPlaying: false,
        isLoading: false,
        onPlay: () {},
        onToggleListened: () {},
      ),
    );

    expect(find.byType(EpisodeDetailScreen), findsNothing);
    expect(find.text('Transcript'), findsNothing);

    await tester.tap(find.byType(EpisodeCard));
    await tester.pumpAndSettle();

    expect(find.byType(EpisodeDetailScreen), findsOneWidget);
    expect(find.text('Transcript'), findsOneWidget);
    expect(find.text('Full transcript body.'), findsOneWidget);
  });

  testWidgets('HeroEpisodeCard opens the detail screen', (tester) async {
    final episode = _episode(title: 'Latest macro cycle');

    await _pumpHarness(
      tester,
      HeroEpisodeCard(
        episode: episode,
        isPlaying: false,
        onPlay: () {},
        onToggleListened: () {},
      ),
    );

    await tester.tap(find.byType(HeroEpisodeCard));
    await tester.pumpAndSettle();

    expect(find.byType(EpisodeDetailScreen), findsOneWidget);
    expect(find.text('Latest macro cycle'), findsWidgets);
  });
}

Future<void> _pumpHarness(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => PlaybackProvider()),
        ChangeNotifierProvider(create: (_) => LikesProvider()),
      ],
      child: MaterialApp(
        theme: AppTheme.dark(),
        home: Scaffold(body: Center(child: child)),
      ),
    ),
  );
  await tester.pump();
}

Episode _episode({
  String title = 'Treasury liquidity watch',
  String? script = 'Line one.\nLine two.',
}) {
  return Episode(
    id: 'episode-1',
    title: title,
    hlsUrl: 'https://cdn.example.com/episode-1.m3u8',
    createdAt: DateTime(2026, 5, 4),
    listened: false,
    likeCount: 123,
    script: script,
  );
}
