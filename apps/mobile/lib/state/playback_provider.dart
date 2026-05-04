import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';
import '../services/audio_player_service.dart';

class PlaybackProvider extends ChangeNotifier {
  PlaybackProvider({AudioPlayerService? audioService})
      : _audioService = audioService ?? AudioPlayerService();

  final AudioPlayerService _audioService;

  StreamSubscription<PlayerState>? _subscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration?>? _durationSubscription;

  Episode? _currentEpisode;
  bool _isPlaying = false;
  String? _loadingEpisodeId;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isInitialized = false;

  Episode? get currentEpisode => _currentEpisode;
  bool get isPlaying => _isPlaying;
  String? get loadingEpisodeId => _loadingEpisodeId;
  Duration get position => _position;
  Duration get duration => _duration;

  bool isEpisodePlaying(String id) {
    return _currentEpisode?.id == id && _isPlaying;
  }

  void _ensureListening() {
    if (_isInitialized) return;

    _subscription = _audioService.playerStateStream?.listen(_handleState);
    _positionSubscription =
        _audioService.positionStream?.listen(_handlePosition);
    _durationSubscription =
        _audioService.durationStream?.listen(_handleDuration);
    _isInitialized = true;
  }

  Future<void> toggle(Episode episode) async {
    if (_currentEpisode?.id == episode.id) {
      if (_isPlaying) {
        await _audioService.pause();
      } else {
        await _audioService.resume();
      }
      return;
    }

    _loadingEpisodeId = episode.id;
    _currentEpisode = episode;
    _position = Duration.zero;
    _duration = Duration.zero;
    notifyListeners();

    try {
      await _audioService.play(episode);
      _ensureListening();
    } finally {
      _loadingEpisodeId = null;
      notifyListeners();
    }
  }

  Future<void> pause() {
    return _audioService.pause();
  }

  Future<void> resume() {
    return _audioService.resume();
  }

  Future<void> seek(Duration position) {
    return _audioService.seek(position);
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
    _audioService.dispose();
    super.dispose();
  }
}
