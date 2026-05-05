import 'package:ai_podcast_mobile/models/episode.dart';
import 'package:ai_podcast_mobile/screens/episode_detail_screen.dart';
import 'package:ai_podcast_mobile/state/auth_provider.dart';
import 'package:ai_podcast_mobile/state/likes_provider.dart';
import 'package:ai_podcast_mobile/state/playback_provider.dart';
import 'package:ai_podcast_mobile/theme/app_theme.dart';
import 'package:ai_podcast_mobile/widgets/mini_player.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fakes/fake_podcast_audio_handler.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('hides speed menu and opens episode detail when tapped',
      (tester) async {
    final handler = FakePodcastAudioHandler();
    final provider = PlaybackProvider(handler);
    final episode = Episode(
      id: 'episode-1',
      title: 'Test episode',
      hlsUrl: 'https://example.com/audio.m3u8',
      createdAt: DateTime(2026),
      listened: false,
    );

    await provider.toggle(episode);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider.value(value: provider),
          ChangeNotifierProvider(create: (_) => LikesProvider()),
        ],
        child: MaterialApp(
          theme: AppTheme.dark(),
          home: const Scaffold(body: MiniPlayer()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Playback speed'), findsNothing);
    expect(find.text('1.0x'), findsNothing);
    expect(find.byType(EpisodeDetailScreen), findsNothing);

    await tester.tap(find.text('Test episode'));
    await tester.pumpAndSettle();

    expect(find.byType(EpisodeDetailScreen), findsOneWidget);
    expect(find.text('Test episode'), findsWidgets);

    provider.dispose();
    await handler.dispose();
  });
}
