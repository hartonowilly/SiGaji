import 'package:supabase_flutter/supabase_flutter.dart';

/// Ambil access token valid; refresh otomatis jika hampir kedaluwarsa.
class SessionToken {
  static Future<String?> bearer() async {
    final client = Supabase.instance.client;
    var session = client.auth.currentSession;
    if (session == null) return null;

    final expiresAt = session.expiresAt;
    if (expiresAt != null) {
      final expiry =
          DateTime.fromMillisecondsSinceEpoch(expiresAt * 1000, isUtc: true);
      final refreshBy = expiry.subtract(const Duration(minutes: 3));
      if (DateTime.now().toUtc().isAfter(refreshBy)) {
        try {
          final res = await client.auth.refreshSession();
          session = res.session ?? client.auth.currentSession;
        } catch (_) {
          return null;
        }
      }
    }

    final token = session?.accessToken;
    if (token == null || token.isEmpty) return null;
    return token;
  }

  static String friendlyAuthError(String? raw) {
    final m = (raw ?? '').toLowerCase();
    if (m.contains('invalid auth') ||
        m.contains('missing authorization') ||
        m.contains('sesi habis')) {
      return 'Sesi login habis — keluar lalu login lagi. '
          'Pastikan URL Supabase di pengaturan sama dengan SiGaji web.';
    }
    return raw ?? 'Gagal';
  }
}
