import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'colors.dart';

abstract final class AppTheme {
  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.accent,
        secondary: AppColors.accentMuted,
        surface: AppColors.surface,
        error: Color(0xFFFF6F61),
        onPrimary: AppColors.background,
        onSecondary: AppColors.textPrimary,
        onSurface: AppColors.textPrimary,
      ),
      scaffoldBackgroundColor: AppColors.background,
    );

    final textTheme = GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: AppColors.textPrimary,
      displayColor: AppColors.textPrimary,
    );

    return base.copyWith(
      textTheme: textTheme.copyWith(
        headlineLarge: textTheme.headlineLarge?.copyWith(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          height: 1.15,
          letterSpacing: 0,
        ),
        titleMedium: textTheme.titleMedium?.copyWith(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
        ),
        bodyMedium: textTheme.bodyMedium?.copyWith(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          letterSpacing: 0,
        ),
        bodySmall: textTheme.bodySmall?.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
          letterSpacing: 0,
        ),
        labelLarge: textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: 0,
        ),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppColors.background.withValues(alpha: 0.94),
        foregroundColor: AppColors.textPrimary,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.background,
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          minimumSize: const Size(48, 48),
          side: const BorderSide(color: AppColors.divider),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          minimumSize: const Size.square(44),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceElevated,
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: AppColors.textSecondary,
        ),
        labelStyle: textTheme.bodySmall,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accent),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.surfaceElevated,
        contentTextStyle: textTheme.bodyMedium,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
