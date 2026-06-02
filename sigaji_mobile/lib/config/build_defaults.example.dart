/// Salin file ini → `build_defaults.dart` dan isi sebelum `flutter build apk`
/// agar APK internal sudah berisi URL default (opsional).
class BuildDefaults {
  static const String apiBaseUrl = 'https://www.cemerlang.online/api/';
  static const String supabaseUrl = 'https://YOUR_PROJECT.supabase.co';
  static const String supabaseAnonKey = 'YOUR_ANON_KEY';
  static const String tenantKey = 'main';
}
