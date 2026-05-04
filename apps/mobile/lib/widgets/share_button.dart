import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../models/episode.dart';
import '../theme/colors.dart';

class ShareButton extends StatelessWidget {
  const ShareButton({
    super.key,
    required this.episode,
    this.compact = false,
  });

  final Episode episode;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Share ${episode.title}',
      child: IconButton(
        tooltip: 'Share',
        visualDensity: compact ? VisualDensity.compact : VisualDensity.standard,
        icon: Icon(
          Icons.ios_share_rounded,
          size: compact ? 18 : 20,
          color: AppColors.textSecondary,
        ),
        onPressed: () {
          Share.share(
            '${episode.title} - ${episode.hlsUrl}',
            subject: episode.title,
          );
        },
      ),
    );
  }
}
