import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/episode.dart';
import '../state/auth_provider.dart';
import '../state/playback_provider.dart';
import '../theme/colors.dart';
import '../utils/date_format.dart';
import '../widgets/like_button.dart';
import '../widgets/share_button.dart';

typedef EpisodeToggleListened = FutureOr<void> Function(Episode episode);

class EpisodeDetailScreen extends StatefulWidget {
  const EpisodeDetailScreen({
    super.key,
    required this.episode,
    this.onToggleListened,
  });

  final Episode episode;
  final EpisodeToggleListened? onToggleListened;

  @override
  State<EpisodeDetailScreen> createState() => _EpisodeDetailScreenState();
}

class _EpisodeDetailScreenState extends State<EpisodeDetailScreen> {
  late Episode _episode = widget.episode;
  final ScrollController _scrollController = ScrollController();
  bool _showAppBarBackground = false;
  bool _showBackToTop = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_handleScroll)
      ..dispose();
    super.dispose();
  }

  void _handleScroll() {
    final offset = _scrollController.offset;
    final nextShowAppBarBackground = offset > 24;
    final nextShowBackToTop = offset > 400;

    if (nextShowAppBarBackground != _showAppBarBackground ||
        nextShowBackToTop != _showBackToTop) {
      setState(() {
        _showAppBarBackground = nextShowAppBarBackground;
        _showBackToTop = nextShowBackToTop;
      });
    }
  }

  Future<void> _toggleListened() async {
    final auth = context.read<AuthProvider>();
    if (auth.currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to mark episodes as played.')),
      );
      return;
    }

    final previous = _episode;
    final next = previous.copyWith(listened: !previous.listened);
    setState(() => _episode = next);

    try {
      final callback = widget.onToggleListened;
      if (callback != null) {
        await callback(previous);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _episode = previous);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Played state failed: $error')),
      );
    }
  }

  void _scrollToTop() {
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final appBarBackground = _showAppBarBackground
        ? AppColors.background.withValues(alpha: 0.94)
        : Colors.transparent;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: appBarBackground,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        leading: IconButton(
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('From Fed to Chain'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ShareButton(
              episode: _episode,
              compact: true,
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            controller: _scrollController,
            physics: const BouncingScrollPhysics(),
            child: Padding(
              padding: EdgeInsets.only(
                top: MediaQuery.paddingOf(context).top + kToolbarHeight + 8,
                bottom: MediaQuery.paddingOf(context).bottom + 32,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _EpisodeHeader(episode: _episode),
                  _PlaybackControls(episode: _episode),
                  const SizedBox(height: 14),
                  _ActionRow(
                    episode: _episode,
                    onToggleListened: _toggleListened,
                  ),
                  const SizedBox(height: 28),
                  _TranscriptSection(episode: _episode),
                ],
              ),
            ),
          ),
          Positioned(
            right: 16,
            bottom: 20,
            child: SafeArea(
              child: IgnorePointer(
                ignoring: !_showBackToTop,
                child: AnimatedOpacity(
                  opacity: _showBackToTop ? 1 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: FloatingActionButton.small(
                    heroTag: 'episode-detail-back-to-top',
                    tooltip: 'Back to top',
                    backgroundColor: AppColors.surfaceElevated,
                    foregroundColor: AppColors.accent,
                    onPressed: _scrollToTop,
                    child: const Icon(Icons.keyboard_arrow_up_rounded),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EpisodeHeader extends StatelessWidget {
  const _EpisodeHeader({required this.episode});

  final Episode episode;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      height: 220,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF5A291B),
            Color(0xFF251916),
            AppColors.surface,
          ],
          stops: [0, 0.48, 1],
        ),
        border: Border.all(color: const Color(0xFF4B2B21)),
        boxShadow: [
          BoxShadow(
            color: AppColors.accent.withValues(alpha: 0.12),
            blurRadius: 36,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -14,
            top: 24,
            child: Icon(
              Icons.graphic_eq_rounded,
              size: 100,
              color: AppColors.accent.withValues(alpha: 0.10),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'LATEST',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.accent,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '-',
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        formatEpisodeDate(episode.createdAt),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Text(
                  episode.title,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.headlineLarge,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlaybackControls extends StatefulWidget {
  const _PlaybackControls({required this.episode});

  final Episode episode;

  @override
  State<_PlaybackControls> createState() => _PlaybackControlsState();
}

class _PlaybackControlsState extends State<_PlaybackControls> {
  double? _scrubValue;
  bool _pressed = false;

  Future<void> _togglePlayback() async {
    setState(() => _pressed = true);
    await Future<void>.delayed(const Duration(milliseconds: 80));
    if (mounted) {
      setState(() => _pressed = false);
    }
    if (!mounted) return;
    await context.read<PlaybackProvider>().toggle(widget.episode);
  }

  @override
  Widget build(BuildContext context) {
    final playback = context.watch<PlaybackProvider>();
    final isCurrent = playback.currentEpisode?.id == widget.episode.id;
    final isPlaying = isCurrent && playback.isPlaying;
    final isLoading = playback.loadingEpisodeId == widget.episode.id;
    final position = isCurrent ? playback.position : Duration.zero;
    final duration = isCurrent ? playback.duration : Duration.zero;
    final durationMs = duration.inMilliseconds;
    final maxValue = durationMs > 0 ? durationMs.toDouble() : 1.0;
    final liveValue = durationMs > 0
        ? position.inMilliseconds.clamp(0, durationMs).toDouble()
        : 0.0;
    final sliderValue = (_scrubValue ?? liveValue).clamp(0.0, maxValue);
    final displayedPosition = Duration(milliseconds: sliderValue.round());

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            AnimatedScale(
              scale: _pressed ? 0.96 : 1,
              duration: const Duration(milliseconds: 90),
              curve: Curves.easeOutCubic,
              child: IconButton.filled(
                tooltip: isPlaying ? 'Pause' : 'Play',
                style: IconButton.styleFrom(
                  fixedSize: const Size.square(52),
                  backgroundColor: AppColors.accent,
                  foregroundColor: AppColors.background,
                ),
                onPressed: isLoading ? null : _togglePlayback,
                icon: isLoading
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.background,
                        ),
                      )
                    : Icon(
                        isPlaying
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        size: 28,
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              _formatDuration(displayedPosition),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textPrimary,
                  ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  activeTrackColor: AppColors.accent,
                  inactiveTrackColor: AppColors.divider,
                  thumbColor: AppColors.accent,
                  overlayColor: AppColors.accent.withValues(alpha: 0.16),
                  trackHeight: 4,
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 6,
                  ),
                ),
                child: Slider(
                  value: sliderValue,
                  min: 0,
                  max: maxValue,
                  onChangeStart: durationMs > 0 && isCurrent
                      ? (value) => setState(() => _scrubValue = value)
                      : null,
                  onChanged: durationMs > 0 && isCurrent
                      ? (value) => setState(() => _scrubValue = value)
                      : null,
                  onChangeEnd: durationMs > 0 && isCurrent
                      ? (value) async {
                          setState(() => _scrubValue = null);
                          await context.read<PlaybackProvider>().seek(
                                Duration(milliseconds: value.round()),
                              );
                        }
                      : null,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatDuration(duration),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDuration(Duration duration) {
    final totalSeconds = duration.inSeconds;
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;
    String twoDigits(int value) => value.toString().padLeft(2, '0');

    if (hours > 0) {
      return '$hours:${twoDigits(minutes)}:${twoDigits(seconds)}';
    }
    return '$minutes:${twoDigits(seconds)}';
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.episode,
    required this.onToggleListened,
  });

  final Episode episode;
  final VoidCallback onToggleListened;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        LikeButton(episode: episode),
        ShareButton(episode: episode),
        _PlayedButton(
          listened: episode.listened,
          onPressed: onToggleListened,
        ),
      ],
    );
  }
}

class _TranscriptSection extends StatelessWidget {
  const _TranscriptSection({required this.episode});

  final Episode episode;

  @override
  Widget build(BuildContext context) {
    final script = episode.script?.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Transcript',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        const SizedBox(height: 12),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Divider(height: 1),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Text(
            script?.isNotEmpty == true ? script! : 'No script available yet.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.6,
                  letterSpacing: 0.2,
                ),
          ),
        ),
      ],
    );
  }
}

class _PlayedButton extends StatelessWidget {
  const _PlayedButton({
    required this.listened,
    required this.onPressed,
  });

  final bool listened;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(
        listened ? Icons.check_circle_rounded : Icons.check_circle_outline,
        size: 19,
        color: listened ? AppColors.success : AppColors.textSecondary,
      ),
      label: Text(listened ? 'Played' : 'Mark played'),
      style: OutlinedButton.styleFrom(
        foregroundColor: listened ? AppColors.success : AppColors.textPrimary,
        side: BorderSide(
          color: listened ? AppColors.success : AppColors.divider,
        ),
      ),
    );
  }
}
