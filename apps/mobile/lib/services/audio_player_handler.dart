import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';

class PodcastAudioHandler extends BaseAudioHandler with SeekHandler {
  final AudioPlayer _player = AudioPlayer();
  late final Future<void> _ready;

  PodcastAudioHandler() {
    _ready = _init();
  }

  Stream<PlayerState> get playerStateStream => _player.playerStateStream;
  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Stream<double> get speedStream => _player.speedStream;
  Duration get duration => _player.duration ?? Duration.zero;

  Future<void> _init() async {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());
    await session.setActive(true);

    session.interruptionEventStream.listen((event) {
      if (event.begin) {
        unawaited(pause());
      } else if (event.type == AudioInterruptionType.pause) {
        unawaited(play());
      }
    });

    _player.playbackEventStream.listen(_broadcastState);

    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        unawaited(stop());
      }
    });

    _player.durationStream.listen((duration) {
      final currentMediaItem = mediaItem.value;
      if (currentMediaItem != null &&
          duration != null &&
          currentMediaItem.duration != duration) {
        mediaItem.add(currentMediaItem.copyWith(duration: duration));
      }
    });

    mediaItem.add(const MediaItem(
      id: 'initial',
      album: 'AI Podcast',
      title: 'From Fed to Chain',
      artist: 'Ready to play',
      duration: Duration.zero,
    ));

    playbackState.add(PlaybackState(
      controls: [
        MediaControl.rewind,
        MediaControl.play,
        MediaControl.fastForward,
        MediaControl.stop,
      ],
      systemActions: const {
        MediaAction.seek,
        MediaAction.seekForward,
        MediaAction.seekBackward,
      },
      androidCompactActionIndices: const [0, 1, 2],
      processingState: AudioProcessingState.idle,
      playing: false,
      updatePosition: Duration.zero,
      bufferedPosition: Duration.zero,
      speed: 1,
      queueIndex: 0,
    ));
  }

  AudioProcessingState _mapProcessingState(ProcessingState state) {
    switch (state) {
      case ProcessingState.idle:
        return AudioProcessingState.idle;
      case ProcessingState.loading:
        return AudioProcessingState.loading;
      case ProcessingState.buffering:
        return AudioProcessingState.buffering;
      case ProcessingState.ready:
        return AudioProcessingState.ready;
      case ProcessingState.completed:
        return AudioProcessingState.completed;
    }
  }

  @override
  Future<void> play() async {
    await _ready;
    await _player.play();
  }

  @override
  Future<void> pause() async {
    await _ready;
    await _player.pause();
  }

  @override
  Future<void> stop() async {
    await _ready;
    await _player.stop();
    await _player.seek(Duration.zero);
    await super.stop();
  }

  @override
  Future<void> seek(Duration position) async {
    await _ready;
    await _player.seek(position);
  }

  @override
  Future<void> skipToNext() async {
    await fastForward();
  }

  @override
  Future<void> skipToPrevious() async {
    await rewind();
  }

  @override
  Future<void> fastForward() async {
    await _ready;
    final newPosition = _player.position + const Duration(seconds: 30);
    final duration = _player.duration;
    if (duration != null && newPosition > duration) {
      await _player.seek(duration);
      return;
    }
    await _player.seek(newPosition);
  }

  @override
  Future<void> rewind() async {
    await _ready;
    final newPosition = _player.position - const Duration(seconds: 10);
    await _player
        .seek(newPosition < Duration.zero ? Duration.zero : newPosition);
  }

  @override
  Future<void> setSpeed(double speed) async {
    await _ready;
    await _player.setSpeed(speed);
  }

  double get speed => _player.speed;

  Future<void> setEpisode(Episode episode) async {
    await _ready;

    final newMediaItem = MediaItem(
      id: episode.id,
      album: 'AI Podcast',
      title: episode.title,
      artist: 'From Fed to Chain',
      duration: Duration.zero,
      extras: {'url': episode.hlsUrl},
    );

    mediaItem.add(newMediaItem);

    try {
      await _player.setAudioSource(
        AudioSource.uri(Uri.parse(episode.hlsUrl)),
      );
    } catch (_) {
      playbackState.add(
        playbackState.value.copyWith(
          processingState: AudioProcessingState.error,
        ),
      );
      rethrow;
    }
  }

  void _broadcastState(PlaybackEvent event) {
    final playing = _player.playing;

    playbackState.add(playbackState.value.copyWith(
      controls: [
        MediaControl.rewind,
        if (playing) MediaControl.pause else MediaControl.play,
        MediaControl.fastForward,
        MediaControl.stop,
      ],
      systemActions: const {
        MediaAction.seek,
        MediaAction.seekForward,
        MediaAction.seekBackward,
      },
      androidCompactActionIndices: const [0, 1, 2],
      processingState: _mapProcessingState(_player.processingState),
      playing: playing,
      updatePosition: _player.position,
      bufferedPosition: _player.bufferedPosition,
      speed: _player.speed,
      queueIndex: 0,
    ));
  }

  Future<void> dispose() async {
    await _player.dispose();
  }
}
