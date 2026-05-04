import 'package:flutter/material.dart';

import '../models/episode.dart';
import '../screens/episode_detail_screen.dart';
import '../theme/colors.dart';
import '../utils/date_format.dart';
import 'like_button.dart';
import 'share_button.dart';

class HeroEpisodeCard extends StatelessWidget {
  const HeroEpisodeCard({
    super.key,
    required this.episode,
    required this.isPlaying,
    required this.onPlay,
    required this.onToggleListened,
  });

  final Episode episode;
  final bool isPlaying;
  final VoidCallback onPlay;
  final VoidCallback onToggleListened;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      constraints: const BoxConstraints(minHeight: 280),
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
        border: Border.all(color: Color(0xFF4B2B21)),
        boxShadow: [
          BoxShadow(
            color: AppColors.accent.withValues(alpha: 0.12),
            blurRadius: 36,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => EpisodeDetailScreen(
                  episode: episode,
                  onToggleListened: (_) => onToggleListened(),
                ),
              ),
            );
          },
          child: Stack(
            children: [
              Positioned(
                right: -20,
                top: 22,
                child: Icon(
                  Icons.graphic_eq_rounded,
                  size: 128,
                  color: AppColors.accent.withValues(alpha: 0.13),
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
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        FilledButton.icon(
                          onPressed: onPlay,
                          icon: Icon(
                            isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                          ),
                          label: Text(isPlaying ? 'Pause' : 'Play'),
                        ),
                        LikeButton(episode: episode),
                        ShareButton(episode: episode),
                        _PlayedButton(
                          listened: episode.listened,
                          onPressed: onToggleListened,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
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
