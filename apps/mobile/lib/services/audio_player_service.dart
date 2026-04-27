import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';

class AudioPlayerService {
  final AudioPlayer _player = AudioPlayer();

  Stream<PlayerState> get playerStateStream => _player.playerStateStream;

  Future<void> play(Episode episode) async {
    await _player.setUrl(episode.hlsUrl);
    await _player.play();
  }

  Future<void> pause() {
    return _player.pause();
  }

  Future<void> resume() {
    return _player.play();
  }

  Future<void> dispose() {
    return _player.dispose();
  }
}
