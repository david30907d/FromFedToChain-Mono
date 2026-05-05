import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../models/episode.dart';
import '../screens/episode_detail_screen.dart';
import '../theme/colors.dart';
import '../utils/date_format.dart';
import 'like_button.dart';
import 'share_button.dart';

class EpisodeCard extends StatefulWidget {
  const EpisodeCard({
    super.key,
    required this.episode,
    required this.isPlaying,
    required this.isLoading,
    required this.onPlay,
    required this.onToggleListened,
  });

  final Episode episode;
  final bool isPlaying;
  final bool isLoading;
  final VoidCallback onPlay;
  final VoidCallback onToggleListened;

  @override
  State<EpisodeCard> createState() => _EpisodeCardState();
}

class _EpisodeCardState extends State<EpisodeCard> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: _openDetail,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _PlayButton(
                  isPlaying: widget.isPlaying,
                  isLoading: widget.isLoading,
                  onPressed: widget.onPlay,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.episode.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            formatEpisodeDate(widget.episode.createdAt),
                            style: theme.textTheme.bodySmall,
                          ),
                          LikeButton(
                            episode: widget.episode,
                            compact: true,
                          ),
                          ShareButton(
                            episode: widget.episode,
                            compact: true,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'More options',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(
                    Icons.more_horiz_rounded,
                    color: AppColors.textSecondary,
                  ),
                  onPressed: _showMoreOptions,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openDetail() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => EpisodeDetailScreen(
          episode: widget.episode,
          onToggleListened: (_) => widget.onToggleListened(),
        ),
      ),
    );
  }

  void _showMoreOptions() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surfaceElevated,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(
                  widget.episode.listened
                      ? Icons.check_circle_rounded
                      : Icons.check_circle_outline_rounded,
                  color: widget.episode.listened
                      ? AppColors.success
                      : AppColors.textSecondary,
                ),
                title: Text(
                  widget.episode.listened ? 'Played' : 'Mark as played',
                ),
                onTap: () {
                  Navigator.pop(sheetContext);
                  widget.onToggleListened();
                },
              ),
              ListTile(
                leading: const Icon(
                  Icons.ios_share_rounded,
                  color: AppColors.textSecondary,
                ),
                title: const Text('Share'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  Share.share(
                    '${widget.episode.title} - ${widget.episode.hlsUrl}',
                    subject: widget.episode.title,
                  );
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}

class _PlayButton extends StatelessWidget {
  const _PlayButton({
    required this.isPlaying,
    required this.isLoading,
    required this.onPressed,
  });

  final bool isPlaying;
  final bool isLoading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton.filled(
      tooltip: isPlaying ? 'Pause' : 'Play',
      style: IconButton.styleFrom(
        backgroundColor: AppColors.surfaceElevated,
        foregroundColor: AppColors.accent,
      ),
      onPressed: isLoading ? null : onPressed,
      icon: isLoading
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(
              isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
            ),
    );
  }
}
