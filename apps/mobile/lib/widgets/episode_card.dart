import 'package:flutter/material.dart';

import '../models/episode.dart';
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

class _EpisodeCardState extends State<EpisodeCard>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;

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
          onTap: () => setState(() => _expanded = !_expanded),
          child: AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
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
                              maxLines: _expanded ? 5 : 2,
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
                      Icon(
                        _expanded
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: AppColors.textSecondary,
                      ),
                    ],
                  ),
                  if (_expanded) ...[
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: widget.onToggleListened,
                            icon: Icon(
                              widget.episode.listened
                                  ? Icons.check_circle_rounded
                                  : Icons.check_circle_outline_rounded,
                              color: widget.episode.listened
                                  ? AppColors.success
                                  : AppColors.textSecondary,
                            ),
                            label: Text(
                              widget.episode.listened
                                  ? 'Played'
                                  : 'Mark played',
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: widget.episode.listened
                                  ? AppColors.success
                                  : AppColors.textPrimary,
                              side: BorderSide(
                                color: widget.episode.listened
                                    ? AppColors.success
                                    : AppColors.divider,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        FilledButton.icon(
                          onPressed: widget.onPlay,
                          icon: Icon(
                            widget.isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                          ),
                          label: Text(widget.isPlaying ? 'Pause' : 'Play'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      widget.episode.script?.trim().isNotEmpty == true
                          ? widget.episode.script!.trim()
                          : 'No script available yet.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.45,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
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
