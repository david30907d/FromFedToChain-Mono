import 'package:flutter/material.dart';

import 'screens/episodes_screen.dart';

void main() {
  runApp(const AiPodcastApp());
}

class AiPodcastApp extends StatelessWidget {
  const AiPodcastApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'AI Podcast',
      debugShowCheckedModeBanner: false,
      home: EpisodesScreen(),
    );
  }
}
