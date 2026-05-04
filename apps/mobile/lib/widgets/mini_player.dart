import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/playback_provider.dart';
import '../theme/colors.dart';

class MiniPlayer extends StatelessWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final playback = context.watch<PlaybackProvider>();
    final episode = playback.currentEpisode;

    return AnimatedSlide(
      offset: episode == null ? const Offset(0, 1.2) : Offset.zero,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
      child: AnimatedOpacity(
        opacity: episode == null ? 0 : 1,
        duration: const Duration(milliseconds: 180),
        child: episode == null
            ? const SizedBox.shrink()
            : SafeArea(
                top: false,
                minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.divider),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.32),
                        blurRadius: 24,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              colors: [AppColors.accent, AppColors.accentMuted],
                            ),
                          ),
                          child: const Icon(
                            Icons.graphic_eq_rounded,
                            color: AppColors.background,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Now playing',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: AppColors.accent,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                episode.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filled(
                          tooltip: playback.isPlaying ? 'Pause' : 'Play',
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.accent,
                            foregroundColor: AppColors.background,
                          ),
                          icon: Icon(
                            playback.isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                          ),
                          onPressed: () {
                            if (playback.isPlaying) {
                              playback.pause();
                            } else {
                              playback.resume();
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}
