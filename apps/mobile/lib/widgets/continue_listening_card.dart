import 'package:flutter/material.dart';

import '../models/episode.dart';
import '../models/episode_status.dart';
import '../screens/episode_detail_screen.dart';
import '../theme/colors.dart';
import '../utils/date_format.dart';
import 'episode_hero_frame.dart';
import 'like_button.dart';
import 'share_button.dart';

class ContinueListeningCard extends StatelessWidget {
  const ContinueListeningCard({
    super.key,
    required this.episode,
    required this.allCompleted,
    required this.isPlaying,
    required this.isLoading,
    required this.onPlay,
    required this.onToggleListened,
  });

  final Episode episode;
  final bool allCompleted;
  final bool isPlaying;
  final bool isLoading;
  final VoidCallback onPlay;
  final VoidCallback onToggleListened;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = episode.status;
    final eyebrow = allCompleted
        ? '已全部聽完'
        : status == EpisodeStatus.inProgress
            ? '繼續收聽'
            : '一鍵播放';
    final title = allCompleted ? '已全部聽完' : episode.title;
    final subtitle = allCompleted
        ? '重新從最舊一集開始播放'
        : status == EpisodeStatus.inProgress
            ? '上次收聽至 ${_formatPosition(episode.lastPositionSeconds)}'
            : '從最舊未聽集開始';
    final buttonLabel = isPlaying
        ? '暫停'
        : allCompleted
            ? '重新從最舊開始'
            : status == EpisodeStatus.inProgress
                ? '繼續收聽'
                : '從最舊未聽開始';

    return EpisodeHeroFrame(
      constraints: const BoxConstraints(minHeight: 250),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                eyebrow,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.accent,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  allCompleted
                      ? '${formatEpisodeDate(episode.createdAt)} 起'
                      : formatEpisodeDate(episode.createdAt),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            title,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.headlineLarge,
          ),
          const SizedBox(height: 10),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              FilledButton.icon(
                onPressed: isLoading ? null : onPlay,
                icon: isLoading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        isPlaying
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                      ),
                label: Text(buttonLabel),
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
    );
  }

  static String _formatPosition(int seconds) {
    final duration = Duration(seconds: seconds);
    final minutes = duration.inMinutes;
    final remainingSeconds = duration.inSeconds.remainder(60);
    return '$minutes:${remainingSeconds.toString().padLeft(2, '0')}';
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
      label: Text(listened ? '已聽完' : '標記已聽'),
      style: OutlinedButton.styleFrom(
        foregroundColor: listened ? AppColors.success : AppColors.textPrimary,
        side: BorderSide(
          color: listened ? AppColors.success : AppColors.divider,
        ),
      ),
    );
  }
}
