import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/episode.dart';
import '../services/audio_player_handler.dart';

class PlaybackProvider extends ChangeNotifier {
  PlaybackProvider(this._handler) {
    _listen();
    unawaited(_loadSpeed());
  }

  static const _speedKey = 'playback_speed';

  final PodcastAudioHandler _handler;

  StreamSubscription<PlayerState>? _subscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration?>? _durationSubscription;
  StreamSubscription<double>? _speedSubscription;

  Episode? _currentEpisode;
  bool _isPlaying = false;
  String? _loadingEpisodeId;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  double _speed = 1.0;
  AudioTrack? _currentAudioTrack;

  Episode? get currentEpisode => _currentEpisode;
  bool get isPlaying => _isPlaying;
  String? get loadingEpisodeId => _loadingEpisodeId;
  Duration get position => _position;
  Duration get duration => _duration;
  double get speed => _speed;
  AudioTrack? get currentAudioTrack => _currentAudioTrack;

  bool isEpisodePlaying(String id) {
    return _currentEpisode?.id == id && _isPlaying;
  }

  void _listen() {
    _subscription = _handler.playerStateStream.listen(_handleState);
    _positionSubscription = _handler.positionStream.listen(_handlePosition);
    _durationSubscription = _handler.durationStream.listen(_handleDuration);
    _speedSubscription = _handler.speedStream.listen(_handleSpeed);
  }

  void _handleSpeed(double speed) {
    _speed = speed;
    notifyListeners();
  }

  Future<void> _loadSpeed() async {
    final prefs = await SharedPreferences.getInstance();
    final speed = prefs.getDouble(_speedKey);
    if (speed == null) return;

    await _handler.setSpeed(speed);
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

    final selectedTrack = _defaultAudioTrackFor(episode);

    _loadingEpisodeId = episode.id;
    _currentEpisode = episode;
    _currentAudioTrack = selectedTrack;
    _position = Duration.zero;
    _duration = Duration.zero;
    notifyListeners();

    try {
      await _handler.setEpisode(episode, audioTrack: selectedTrack);
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

  Future<void> setSpeed(double speed) async {
    await _handler.setSpeed(speed);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_speedKey, speed);
  }

  Future<void> setAudioTrack(AudioTrack track) async {
    final episode = _currentEpisode;
    if (episode == null) return;

    final playableTracks = episode.playableAudioTracks;
    if (!playableTracks.contains(track) || _currentAudioTrack == track) {
      return;
    }

    final previousTrack = _currentAudioTrack;
    _currentAudioTrack = track;
    notifyListeners();

    try {
      await _handler.setAudioTrack(episode, track);
    } catch (_) {
      _currentAudioTrack = previousTrack;
      notifyListeners();
      rethrow;
    }
  }

  void _handleState(PlayerState state) {
    _isPlaying = state.playing;
    if (state.processingState == ProcessingState.completed) {
      _isPlaying = false;
      _currentEpisode = null;
      _currentAudioTrack = null;
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
    _speedSubscription?.cancel();
    unawaited(_handler.dispose());
    super.dispose();
  }

  AudioTrack? _defaultAudioTrackFor(Episode episode) {
    final tracks = episode.playableAudioTracks;
    if (tracks.isEmpty) return null;
    return tracks.first;
  }
}
