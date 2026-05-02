import 'package:flutter/material.dart';

import '../models/episode.dart';
import '../utils/date_format.dart';

class EpisodeDetailScreen extends StatelessWidget {
  const EpisodeDetailScreen({
    super.key,
    required this.episode,
  });

  final Episode episode;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Episode'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              episode.title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              formatEpisodeDate(episode.createdAt),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 24),
            if (episode.script != null && episode.script!.isNotEmpty) ...[
              Text(
                'Script',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(episode.script!),
            ] else
              const Text('No script available'),
          ],
        ),
      ),
    );
  }
}
