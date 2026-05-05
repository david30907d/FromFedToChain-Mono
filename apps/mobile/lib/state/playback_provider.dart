import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';
import '../services/audio_player_handler.dart';

class PlaybackProvider extends ChangeNotifier {
  PlaybackProvider(this._handler) {
    _listen();
  }

  final PodcastAudioHandler _handler;

  StreamSubscription<PlayerState>? _subscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration?>? _durationSubscription;

  Episode? _currentEpisode;
  bool _isPlaying = false;
  String? _loadingEpisodeId;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  Episode? get currentEpisode => _currentEpisode;
  bool get isPlaying => _isPlaying;
  String? get loadingEpisodeId => _loadingEpisodeId;
  Duration get position => _position;
  Duration get duration => _duration;

  bool isEpisodePlaying(String id) {
    return _currentEpisode?.id == id && _isPlaying;
  }

  void _listen() {
    _subscription = _handler.playerStateStream.listen(_handleState);
    _positionSubscription = _handler.positionStream.listen(_handlePosition);
    _durationSubscription = _handler.durationStream.listen(_handleDuration);
  }

  Future<void> toggle(Episode episode) async {
    if (_currentEpisode?.id == episode.id) {
      if (_isPlaying) {
        await _handler.pause();
      } else {
        await _handler.play();
      }
      return;
    }

    _loadingEpisodeId = episode.id;
    _currentEpisode = episode;
    _position = Duration.zero;
    _duration = Duration.zero;
    notifyListeners();

    try {
      await _handler.setEpisode(episode);
      await _handler.play();
    } finally {
      _loadingEpisodeId = null;
      notifyListeners();
    }
  }

  Future<void> pause() {
    return _handler.pause();
  }

  Future<void> resume() {
    return _handler.play();
  }

  Future<void> seek(Duration position) {
    return _handler.seek(position);
  }

  void _handleState(PlayerState state) {
    _isPlaying = state.playing;
    if (state.processingState == ProcessingState.completed) {
      _isPlaying = false;
      _currentEpisode = null;
      _position = Duration.zero;
      _duration = Duration.zero;
    }
    notifyListeners();
  }

  void _handlePosition(Duration position) {
    _position = position;
    notifyListeners();
  }

  void _handleDuration(Duration? duration) {
    _duration = duration ?? Duration.zero;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _positionSubscription?.cancel();
    _durationSubscription?.cancel();
    unawaited(_handler.dispose());
    super.dispose();
  }
}
