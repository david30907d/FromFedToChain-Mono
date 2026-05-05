import 'package:ai_podcast_mobile/models/episode.dart';
import 'package:ai_podcast_mobile/state/playback_provider.dart';
import 'package:ai_podcast_mobile/theme/app_theme.dart';
import 'package:ai_podcast_mobile/widgets/mini_player.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'fakes/fake_podcast_audio_handler.dart';

void main() {
  testWidgets('speed menu updates playback speed through the provider',
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
      ChangeNotifierProvider.value(
        value: provider,
        child: MaterialApp(
          theme: AppTheme.dark(),
          home: const Scaffold(body: MiniPlayer()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('1.0x'), findsOneWidget);

    await tester.tap(find.byTooltip('Playback speed'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('1.5x').last);
    await tester.pumpAndSettle();

    expect(handler.speed, 1.5);
    expect(find.text('1.5x'), findsOneWidget);

    provider.dispose();
    await handler.dispose();
  });
}
