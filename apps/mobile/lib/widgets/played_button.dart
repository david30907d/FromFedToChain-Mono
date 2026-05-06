import 'package:flutter/material.dart';

import '../theme/colors.dart';

class PlayedButton extends StatelessWidget {
  const PlayedButton({
    super.key,
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
