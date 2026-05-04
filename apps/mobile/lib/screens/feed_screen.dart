import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/episode.dart';
import '../services/episode_service.dart';
import '../state/auth_provider.dart';
import '../state/likes_provider.dart';
import '../state/playback_provider.dart';
import '../theme/colors.dart';
import '../widgets/episode_card.dart';
import '../widgets/hero_episode_card.dart';
import '../widgets/mini_player.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({
    super.key,
    EpisodeService? episodeService,
  }) : _episodeService = episodeService;

  final EpisodeService? _episodeService;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  late final EpisodeService _episodeService =
      widget._episodeService ?? EpisodeService();
  final ScrollController _scrollController = ScrollController();

  List<Episode> _episodes = const [];
  String? _nextCursor;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String? _loadMoreError;
  int _requestEpoch = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AuthProvider>().currentUser;
      if (user != null) {
        context.read<LikesProvider>().watchUser(user.id);
      }
      unawaited(_loadFirstPage());
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
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
      final page = await _episodeService.getEpisodes(limit: 20);
      final hydrated = await _applyUserState(page.items);
      if (!mounted || epoch != _requestEpoch) return;

      setState(() {
        _episodes = hydrated;
        _nextCursor = page.nextCursor;
        _loading = false;
      });
      context.read<LikesProvider>().seedEpisodes(hydrated);
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
    setState(() {
      _loadingMore = true;
      _loadMoreError = null;
    });

    try {
      final page = await _episodeService.getEpisodes(
        limit: 20,
        cursor: _nextCursor,
      );
      final hydrated = await _applyUserState(page.items);
      if (!mounted || epoch != _requestEpoch) return;

      setState(() {
        _episodes = [..._episodes, ...hydrated];
        _nextCursor = page.nextCursor;
        _loadingMore = false;
      });
      context.read<LikesProvider>().seedEpisodes(_episodes);
    } catch (error) {
      if (!mounted || epoch != _requestEpoch) return;
      setState(() {
        _loadingMore = false;
        _loadMoreError = error.toString();
      });
    }
  }

  Future<List<Episode>> _applyUserState(List<Episode> episodes) async {
    final user = context.read<AuthProvider>().currentUser;
    if (user == null || episodes.isEmpty) return episodes;

    final listenedIds = await _episodeService.getListenedEpisodeIds(user.id);
    return episodes
        .map(
          (episode) => episode.copyWith(
            listened: episode.listened || listenedIds.contains(episode.id),
          ),
        )
        .toList(growable: false);
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels > position.maxScrollExtent - 360) {
      unawaited(_loadMore());
    }
  }

  Future<void> _toggleListened(Episode episode) async {
    final user = context.read<AuthProvider>().currentUser;
    if (user == null) return;

    final nextValue = !episode.listened;
    setState(() {
      _episodes = _episodes
          .map(
            (item) => item.id == episode.id
                ? item.copyWith(listened: nextValue)
                : item,
          )
          .toList(growable: false);
    });

    try {
      await _episodeService.setListened(
        userId: user.id,
        episodeId: episode.id,
        listened: nextValue,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _episodes = _episodes
            .map(
              (item) => item.id == episode.id
                  ? item.copyWith(listened: episode.listened)
                  : item,
            )
            .toList(growable: false);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Played state failed: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final playback = context.watch<PlaybackProvider>();

    return Scaffold(
      body: Stack(
        children: [
          RefreshIndicator(
            color: AppColors.accent,
            backgroundColor: AppColors.surfaceElevated,
            onRefresh: _loadFirstPage,
            child: CustomScrollView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverAppBar(
                  pinned: true,
                  title: const Text('From Fed to Chain'),
                  actions: [
                    Padding(
                      padding: const EdgeInsets.only(right: 16),
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: AppColors.surfaceElevated,
                        foregroundColor: AppColors.accent,
                        child: Text(_avatarLabel(user?.email)),
                      ),
                    ),
                  ],
                ),
                if (_loading)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_error != null)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: _ErrorState(
                      message: _error!,
                      onRetry: _loadFirstPage,
                    ),
                  )
                else if (_episodes.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: _EmptyState(),
                  )
                else ...[
                  SliverToBoxAdapter(
                    child: HeroEpisodeCard(
                      episode: _episodes.first,
                      isPlaying: playback.isEpisodePlaying(_episodes.first.id),
                      onPlay: () => playback.toggle(_episodes.first),
                      onToggleListened: () => _toggleListened(_episodes.first),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: Row(
                        children: [
                          Text(
                            'Episodes',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontSize: 18),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(child: Divider()),
                        ],
                      ),
                    ),
                  ),
                  SliverList.builder(
                    itemCount: _episodes.length - 1,
                    itemBuilder: (context, index) {
                      final episode = _episodes[index + 1];
                      return EpisodeCard(
                        episode: episode,
                        isPlaying: playback.isEpisodePlaying(episode.id),
                        isLoading: playback.loadingEpisodeId == episode.id,
                        onPlay: () => playback.toggle(episode),
                        onToggleListened: () => _toggleListened(episode),
                      );
                    },
                  ),
                  SliverToBoxAdapter(
                    child: _LoadMoreStatus(
                      loading: _loadingMore,
                      error: _loadMoreError,
                      hasMore: _nextCursor != null,
                      onRetry: _loadMore,
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 108)),
                ],
              ],
            ),
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: MiniPlayer(),
          ),
        ],
      ),
    );
  }

  static String _avatarLabel(String? email) {
    final value = email?.trim();
    if (value == null || value.isEmpty) return 'F';
    return value.characters.first.toUpperCase();
  }
}

class _LoadMoreStatus extends StatelessWidget {
  const _LoadMoreStatus({
    required this.loading,
    required this.error,
    required this.hasMore,
    required this.onRetry,
  });

  final bool loading;
  final String? error;
  final bool hasMore;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (error != null) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: OutlinedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }

    return SizedBox(height: hasMore ? 24 : 12);
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            color: AppColors.accent,
            size: 42,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        'No episodes yet.',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
            ),
      ),
    );
  }
}
