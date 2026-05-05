import 'package:ai_podcast_mobile/models/episode.dart';
import 'package:ai_podcast_mobile/state/playback_provider.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fakes/fake_podcast_audio_handler.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

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

  test('setSpeed delegates to the handler and tracks speed stream updates',
      () async {
    final handler = FakePodcastAudioHandler();
    final provider = PlaybackProvider(handler);

    await provider.setSpeed(1.5);

    expect(handler.speed, 1.5);
    expect(provider.speed, 1.5);

    provider.dispose();
    await handler.dispose();
  });

  test('setSpeed persists the chosen speed to SharedPreferences', () async {
    SharedPreferences.setMockInitialValues({});
    final handler = FakePodcastAudioHandler();
    final provider = PlaybackProvider(handler);

    await provider.setSpeed(1.75);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getDouble('playback_speed'), 1.75,
        reason: 'speed must survive app restarts via local prefs');

    provider.dispose();
    await handler.dispose();
  });

  test('PlaybackProvider restores stored speed on construction', () async {
    SharedPreferences.setMockInitialValues({'playback_speed': 1.25});
    final handler = FakePodcastAudioHandler();
    final provider = PlaybackProvider(handler);

    // _loadSpeed() runs asynchronously from the constructor; let it settle.
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(handler.speed, 1.25,
        reason: 'saved speed must be re-applied to the audio handler at start');
    expect(provider.speed, 1.25);

    provider.dispose();
    await handler.dispose();
  });

  test('PlaybackProvider falls back to 1.0x when no speed is stored',
      () async {
    SharedPreferences.setMockInitialValues({});
    final handler = FakePodcastAudioHandler();
    final provider = PlaybackProvider(handler);

    await Future<void>.delayed(Duration.zero);

    expect(handler.speed, 1.0);
    expect(provider.speed, 1.0);

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
