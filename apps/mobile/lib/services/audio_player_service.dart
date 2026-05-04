import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';
import 'audio_player_handler.dart';

class AudioPlayerService {
  AudioPlayer? _player;
  PodcastAudioHandler? _handler;

  Stream<PlayerState>? _playerStateStream;
  Stream<Duration>? _positionStream;
  Stream<Duration?>? _durationStream;

  Future<void> init() async {
    if (_handler != null) return;

    _player = AudioPlayer();
    _handler = await AudioService.init(
      builder: () => PodcastAudioHandler(_player!),
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'com.example.aipodcast.audio',
        androidNotificationChannelName: 'AI Podcast',
        androidNotificationOngoing: true,
      ),
    );

    _playerStateStream = _player!.playerStateStream;
    _positionStream = _player!.positionStream;
    _durationStream = _player!.durationStream;
  }

  Stream<PlayerState>? get playerStateStream => _playerStateStream;
  Stream<Duration>? get positionStream => _positionStream;
  Stream<Duration?>? get durationStream => _durationStream;

  Future<void> play(Episode episode) async {
    await init();
    await _player!.setUrl(episode.hlsUrl);
    await _handler!.setEpisode(episode);
    await _handler!.play();
  }

  Future<void> pause() async {
    await _handler?.pause();
  }

  Future<void> resume() async {
    await _handler?.play();
  }

  Future<void> seek(Duration position) async {
    await _player?.seek(position);
  }

  Future<void> dispose() async {
    await _player?.dispose();
    _player = null;
    _handler = null;
  }
}
