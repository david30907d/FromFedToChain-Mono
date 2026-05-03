import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/episode.dart';
import '../services/api_service.dart';
import '../services/audio_player_service.dart';
import '../utils/date_format.dart';
import 'episode_feed_rows.dart';
import 'episode_detail_screen.dart';

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
  final ScrollController _scroll = ScrollController();
  List<Episode> _episodes = const [];
  String? _nextCursor;
  bool _loadingMore = false;
  String? _loadMoreError;
  Set<String> _collapsedMonths = <String>{};
  int _requestEpoch = 0;
  bool _restoredCollapse = false;
  bool _hasPersistedCollapse = false;
  bool _loading = true;
  String? _error;
  String? _currentEpisodeId;
  bool _isPlaying = false;

  @override
  void initState() {
    super.initState();
    _playerStateSubscription =
        _audioService.playerStateStream.listen(_handlePlayerState);
    unawaited(_initializeFeed());
  }

  @override
  void dispose() {
    _playerStateSubscription?.cancel();
    _scroll.dispose();

    if (_ownsAudioService) {
      _audioService.dispose();
    }

    if (_ownsApiService) {
      _apiService.close();
    }

    super.dispose();
  }

  Future<void> _initializeFeed() async {
    await _restoreCollapse();
    if (!mounted) return;

    await _loadFirstPage();
    if (!mounted) return;
    _scroll.addListener(_onScroll);
  }

  Future<void> _restoreCollapse() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList('collapsed_months');
    _hasPersistedCollapse = saved != null;
    if (saved != null) {
      _collapsedMonths = saved.toSet();
    }
  }

  Future<void> _persistCollapse() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      'collapsed_months',
      _collapsedMonths.toList(growable: false),
    );
  }

  Future<void> _loadFirstPage() async {
    final epoch = ++_requestEpoch;
    setState(() {
      _loading = true;
      _error = null;
      _loadingMore = false;
      _loadMoreError = null;
    });

    try {
      final page = await _apiService.getEpisodes(limit: 20);

      if (!mounted || epoch != _requestEpoch) return;
      setState(() {
        _episodes = page.items;
        _nextCursor = page.nextCursor;
        _loading = false;
        _loadMoreError = null;
      });
      if (!_restoredCollapse) {
        _applyDefaultCollapse();
      }
    } catch (error) {
      if (!mounted || epoch != _requestEpoch) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;

    final epoch = _requestEpoch;
    final existingMonthKeys =
        _episodes.map((episode) => episodeMonthKey(episode.createdAt)).toSet();
    setState(() {
      _loadingMore = true;
      _loadMoreError = null;
    });

    try {
      final page = await _apiService.getEpisodes(
        limit: 20,
        cursor: _nextCursor,
      );

      if (!mounted || epoch != _requestEpoch) return;
      setState(() {
        _episodes = [..._episodes, ...page.items];
        _nextCursor = page.nextCursor;
        _loadingMore = false;
        if (!_hasPersistedCollapse) {
          final currentMonth = episodeMonthKey(DateTime.now());
          final newOlderMonths = page.items
              .map((episode) => episodeMonthKey(episode.createdAt))
              .where((key) => key != currentMonth)
              .where((key) => !existingMonthKeys.contains(key));
          _collapsedMonths = {..._collapsedMonths, ...newOlderMonths};
        }
      });
      if (!_hasPersistedCollapse) {
        unawaited(_persistCollapse());
      }
    } catch (error) {
      if (!mounted || epoch != _requestEpoch) return;
      setState(() {
        _loadingMore = false;
        _loadMoreError = error.toString();
      });
    }
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;

    final position = _scroll.position;
    if (position.pixels > position.maxScrollExtent - 300 &&
        _nextCursor != null &&
        !_loadingMore) {
      unawaited(_loadMore());
    }
  }

  void _applyDefaultCollapse() {
    _restoredCollapse = true;
    if (_hasPersistedCollapse) return;

    final currentMonth = episodeMonthKey(DateTime.now());
    final collapsed = _episodes
        .map((episode) => episodeMonthKey(episode.createdAt))
        .where((key) => key != currentMonth)
        .toSet();

    setState(() {
      _collapsedMonths = collapsed;
    });
    unawaited(_persistCollapse());
  }

  void _toggleMonth(String key) {
    setState(() {
      if (_collapsedMonths.contains(key)) {
        _collapsedMonths.remove(key);
      } else {
        _collapsedMonths.add(key);
      }
    });
    unawaited(_persistCollapse());
  }

  Future<void> _togglePlayback(Episode episode) async {
    try {
      if (_currentEpisodeId == episode.id) {
        await (_isPlaying ? _audioService.pause() : _audioService.resume());
        return;
      }

      setState(() => _currentEpisodeId = episode.id);
      await _audioService.play(episode);
    } catch (error) {
      if (!mounted) return;
      setState(() => _currentEpisodeId = null);
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
        _currentEpisodeId = null;
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
            onPressed: _loading ? null : _loadFirstPage,
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
              onPressed: _loadFirstPage,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_episodes.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadFirstPage,
        child: ListView(
          children: const [
            SizedBox(height: 240),
            Center(child: Text('No episodes yet')),
          ],
        ),
      );
    }

    final rows = buildEpisodeFeedRows(
      episodes: _episodes,
      collapsedMonths: _collapsedMonths,
      nextCursor: _nextCursor,
      loadingMore: _loadingMore,
      loadMoreError: _loadMoreError,
    );

    return RefreshIndicator(
      onRefresh: _loadFirstPage,
      child: ListView.builder(
        controller: _scroll,
        padding: const EdgeInsets.all(12),
        itemBuilder: (context, index) {
          final row = rows[index];

          return switch (row) {
            EpisodeMonthHeaderRow() => Padding(
                key: ValueKey('h:${row.monthKey}'),
                padding: const EdgeInsets.only(bottom: 8),
                child: _MonthHeaderTile(
                  row: row,
                  onTap: () => _toggleMonth(row.monthKey),
                ),
              ),
            EpisodeItemRow() => Padding(
                key: ValueKey('e:${row.episode.id}'),
                padding: const EdgeInsets.only(bottom: 8),
                child: _buildEpisodeCard(row.episode),
              ),
            EpisodeLoadMoreRow() => Padding(
                key: const ValueKey('lm'),
                padding: const EdgeInsets.only(bottom: 8),
                child: _LoadMoreTile(
                  loading: row.loading,
                  error: row.error,
                  onRetry: () => unawaited(_loadMore()),
                ),
              ),
          };
        },
        itemCount: rows.length,
      ),
    );
  }

  Widget _buildEpisodeCard(Episode episode) {
    final selected = episode.id == _currentEpisodeId;
    final playing = selected && _isPlaying;

    return _EpisodeCard(
      key: ValueKey(episode.id),
      episode: episode,
      isPlaying: playing,
      onPlayPressed: () => _togglePlayback(episode),
      onListenedPressed: () => _markListened(episode),
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => EpisodeDetailScreen(episode: episode),
          ),
        );
      },
    );
  }
}

class _MonthHeaderTile extends StatelessWidget {
  const _MonthHeaderTile({
    required this.row,
    required this.onTap,
  });

  final EpisodeMonthHeaderRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        child: Row(
          children: [
            Icon(
              row.collapsed ? Icons.chevron_right : Icons.expand_more,
              size: 24,
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                row.label,
                style: textTheme.titleMedium,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '(${row.loadedCount})',
              style: textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadMoreTile extends StatelessWidget {
  const _LoadMoreTile({
    required this.loading,
    required this.error,
    required this.onRetry,
  });

  final bool loading;
  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (error == null) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Could not load more episodes',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _EpisodeCard extends StatelessWidget {
  const _EpisodeCard({
    super.key,
    required this.episode,
    required this.isPlaying,
    required this.onPlayPressed,
    required this.onListenedPressed,
    required this.onTap,
  });

  final Episode episode;
  final bool isPlaying;
  final VoidCallback onPlayPressed;
  final VoidCallback onListenedPressed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
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
          subtitle: Text(formatEpisodeDate(episode.createdAt)),
          trailing: IconButton(
            tooltip: episode.listened ? 'Listened' : 'Mark listened',
            onPressed: episode.listened ? null : onListenedPressed,
            icon: Icon(
              episode.listened
                  ? Icons.check_circle
                  : Icons.radio_button_unchecked,
            ),
          ),
        ),
      ),
    );
  }
}
