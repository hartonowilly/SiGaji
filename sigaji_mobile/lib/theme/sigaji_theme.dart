import 'package:flutter/material.dart';

class SigajiColors {
  static const brand = Color(0xFF1A56A0);
  static const brandLight = Color(0xFFE8F0FB);
  static const success = Color(0xFF2D6A0A);
  static const warn = Color(0xFF7D4800);
  static const error = Color(0xFF9B2121);
}

ThemeData sigajiTheme() {
  return ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: SigajiColors.brand,
      brightness: Brightness.light,
    ),
    useMaterial3: true,
    textTheme: const TextTheme(
      bodyLarge: TextStyle(fontSize: 16),
      bodyMedium: TextStyle(fontSize: 15),
      titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      isDense: true,
    ),
  );
}
