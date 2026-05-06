import 'package:flutter/material.dart';

import '../models/episode.dart';
import '../screens/episode_detail_screen.dart';
import 'episode_hero_frame.dart';
import 'like_button.dart';
import 'played_button.dart';
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
    return EpisodeHeroFrame(
      constraints: const BoxConstraints(minHeight: 280),
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
      child: EpisodeHeroText(
        episode: episode,
        footer: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            FilledButton.icon(
              onPressed: onPlay,
              icon: Icon(
                isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
              ),
              label: Text(isPlaying ? 'Pause' : 'Play'),
            ),
            LikeButton(episode: episode),
            ShareButton(episode: episode),
            PlayedButton(
              listened: episode.listened,
              onPressed: onToggleListened,
            ),
          ],
        ),
      ),
    );
  }
}
