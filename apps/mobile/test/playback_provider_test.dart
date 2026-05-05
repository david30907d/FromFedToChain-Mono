import 'package:ai_podcast_mobile/models/episode.dart';
import 'package:ai_podcast_mobile/state/playback_provider.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes/fake_podcast_audio_handler.dart';

void main() {
  test('toggle loads a new episode through the handler and starts playback',
      () async {
    final handler = FakePodcastAudioHandler();
    final provider = PlaybackProvider(handler);
    final episode = _episode('episode-1');

    await provider.toggle(episode);

    expect(handler.loadedEpisodeIds, ['episode-1']);
    expect(handler.playCount, 1);
    expect(provider.currentEpisode, episode);
    expect(provider.isPlaying, isTrue);
    expect(provider.loadingEpisodeId, isNull);

    provider.dispose();
    await handler.dispose();
  });

  test('toggle pauses and resumes the current episode without reloading it',
      () async {
    final handler = FakePodcastAudioHandler();
    final provider = PlaybackProvider(handler);
    final episode = _episode('episode-1');

    await provider.toggle(episode);
    await provider.toggle(episode);
    await provider.toggle(episode);

    expect(handler.loadedEpisodeIds, ['episode-1']);
    expect(handler.pauseCount, 1);
    expect(handler.playCount, 2);

    provider.dispose();
    await handler.dispose();
  });
}

Episode _episode(String id) {
  return Episode(
    id: id,
    title: 'Test episode',
    hlsUrl: 'https://example.com/audio.m3u8',
    createdAt: DateTime(2026),
    listened: false,
  );
}
