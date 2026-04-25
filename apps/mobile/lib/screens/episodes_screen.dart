import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';
import '../services/api_service.dart';
import '../services/audio_player_service.dart';

class EpisodesScreen extends StatefulWidget {
  const EpisodesScreen({
    super.key,
    ApiService? apiService,
    AudioPlayerService? audioService,
  })  : _apiService = apiService,
        _audioService = audioService;

  final ApiService? _apiService;
  final AudioPlayerService? _audioService;

  @override
  State<EpisodesScreen> createState() => _EpisodesScreenState();
}

class _EpisodesScreenState extends State<EpisodesScreen> {
  late final ApiService _apiService = widget._apiService ?? ApiService();
  late final AudioPlayerService _audioService =
      widget._audioService ?? AudioPlayerService();
  late final bool _ownsApiService = widget._apiService == null;
  late final bool _ownsAudioService = widget._audioService == null;

  StreamSubscription<PlayerState>? _playerStateSubscription;
  List<Episode> _episodes = const [];
  bool _loading = true;
  String? _error;
  String? _currentEpisodeId;
  bool _isPlaying = false;

  @override
  void initState() {
    super.initState();
    _playerStateSubscription =
        _audioService.playerStateStream.listen(_handlePlayerState);
    _loadEpisodes();
  }

  @override
  void dispose() {
    _playerStateSubscription?.cancel();

    if (_ownsAudioService) {
      _audioService.dispose();
    }

    if (_ownsApiService) {
      _apiService.close();
    }

    super.dispose();
  }

  Future<void> _loadEpisodes() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final episodes = await _apiService.getEpisodes();

      if (!mounted) return;
      setState(() {
        _episodes = episodes;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _togglePlayback(Episode episode) async {
    try {
      if (_currentEpisodeId == episode.id && _isPlaying) {
        await _audioService.pause();
        return;
      }

      if (_currentEpisodeId == episode.id) {
        await _audioService.resume();
        return;
      }

      setState(() => _currentEpisodeId = episode.id);
      await _audioService.play(episode);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Playback failed: $error')),
      );
    }
  }

  Future<void> _markListened(Episode episode) async {
    if (episode.listened) return;

    try {
      final updated = await _apiService.markListened(episode.id);
      if (!mounted) return;

      setState(() {
        _episodes = _episodes
            .map((item) => item.id == updated.id ? updated : item)
            .toList(growable: false);
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Update failed: $error')),
      );
    }
  }

  void _handlePlayerState(PlayerState state) {
    if (!mounted) return;

    setState(() {
      _isPlaying = state.playing;
      if (state.processingState == ProcessingState.completed) {
        _isPlaying = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Podcast'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _loadEpisodes,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Failed to load episodes'),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _loadEpisodes,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_episodes.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadEpisodes,
        child: ListView(
          children: const [
            SizedBox(height: 240),
            Center(child: Text('No episodes yet')),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadEpisodes,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemBuilder: (context, index) {
          final episode = _episodes[index];
          final selected = episode.id == _currentEpisodeId;
          final playing = selected && _isPlaying;

          return _EpisodeCard(
            episode: episode,
            isPlaying: playing,
            onPlayPressed: () => _togglePlayback(episode),
            onListenedPressed: () => _markListened(episode),
          );
        },
        separatorBuilder: (context, index) => const SizedBox(height: 8),
        itemCount: _episodes.length,
      ),
    );
  }
}

class _EpisodeCard extends StatelessWidget {
  const _EpisodeCard({
    required this.episode,
    required this.isPlaying,
    required this.onPlayPressed,
    required this.onListenedPressed,
  });

  final Episode episode;
  final bool isPlaying;
  final VoidCallback onPlayPressed;
  final VoidCallback onListenedPressed;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(8, 8, 4, 8),
        leading: IconButton(
          tooltip: isPlaying ? 'Pause' : 'Play',
          onPressed: onPlayPressed,
          icon: Icon(isPlaying ? Icons.pause_circle : Icons.play_circle),
          iconSize: 36,
        ),
        title: Text(
          episode.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(_formatDate(episode.createdAt)),
        trailing: IconButton(
          tooltip: episode.listened ? 'Listened' : 'Mark listened',
          onPressed: episode.listened ? null : onListenedPressed,
          icon: Icon(
            episode.listened ? Icons.check_circle : Icons.radio_button_unchecked,
          ),
        ),
      ),
    );
  }

  static String _formatDate(DateTime date) {
    String twoDigits(int value) => value.toString().padLeft(2, '0');

    return [
      '${date.year}-${twoDigits(date.month)}-${twoDigits(date.day)}',
      '${twoDigits(date.hour)}:${twoDigits(date.minute)}',
    ].join(' ');
  }
}
