import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';
import '../services/audio_player_service.dart';

class PlaybackProvider extends ChangeNotifier {
  PlaybackProvider({AudioPlayerService? audioService})
      : _audioService = audioService ?? AudioPlayerService() {
    _subscription = _audioService.playerStateStream.listen(_handleState);
  }

  final AudioPlayerService _audioService;
  late final StreamSubscription<PlayerState> _subscription;

  Episode? _currentEpisode;
  bool _isPlaying = false;
  String? _loadingEpisodeId;

  Episode? get currentEpisode => _currentEpisode;
  bool get isPlaying => _isPlaying;
  String? get loadingEpisodeId => _loadingEpisodeId;

  bool isEpisodePlaying(String id) {
    return _currentEpisode?.id == id && _isPlaying;
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
    notifyListeners();

    try {
      await _audioService.play(episode);
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

  void _handleState(PlayerState state) {
    _isPlaying = state.playing;
    if (state.processingState == ProcessingState.completed) {
      _isPlaying = false;
      _currentEpisode = null;
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription.cancel();
    _audioService.dispose();
    super.dispose();
  }
}
