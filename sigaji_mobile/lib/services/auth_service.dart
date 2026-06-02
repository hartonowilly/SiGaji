import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

class EmployeeProfile {
  EmployeeProfile({required this.nama, required this.nik, this.role = ''});

  final String nama;
  final String nik;
  final String role;
}

class AuthService {
  AuthService(this.config);

  final AppConfig config;
  static bool _supabaseReady = false;
  static String? _initUrl;

  SupabaseClient get _sb => Supabase.instance.client;

  Future<void> initSupabase() async {
    if (!config.isConfigured) {
      throw Exception('Konfigurasi server belum diisi');
    }
    final url = config.supabaseUrl.trim();
    final key = config.supabaseAnonKey.trim();
    if (_supabaseReady && _initUrl == url) return;
    await Supabase.initialize(url: url, anonKey: key);
    _supabaseReady = true;
    _initUrl = url;
  }

  static void resetSupabaseInit() {
    _supabaseReady = false;
    _initUrl = null;
  }

  bool get hasSession => _sb.auth.currentSession != null;

  Future<void> signIn(String email, String password) async {
    final res = await _sb.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
    if (res.session == null) {
      throw Exception('Login gagal');
    }
  }

  Future<void> signOut() async {
    await _sb.auth.signOut();
  }

  Future<EmployeeProfile> loadProfile() async {
    final user = _sb.auth.currentUser;
    if (user == null) throw Exception('Belum login');

    final res = await _sb
        .from('sigaji_cloud')
        .select('payload')
        .eq('tenant_key', config.tenantKey)
        .maybeSingle();

    final payload = (res?['payload'] as Map<String, dynamic>?) ?? {};
    final users = (payload['users'] as List<dynamic>?) ?? [];
    final email = (user.email ?? '').toLowerCase();
    final uid = user.id;

    Map<String, dynamic>? match;
    for (final u in users) {
      if (u is! Map) continue;
      if (u['aktif'] == false) continue;
      final em = (u['email'] as String?)?.toLowerCase();
      if (em != null && em == email) {
        match = Map<String, dynamic>.from(u);
        break;
      }
    }
    if (match == null) {
      for (final u in users) {
        if (u is! Map) continue;
        if (u['aktif'] == false) continue;
        if (u['auth_uid'] == uid) {
          match = Map<String, dynamic>.from(u);
          break;
        }
      }
    }

    if (match == null) {
      throw Exception('User tidak ada di data SiGaji — hubungi HRD');
    }
    final nik = (match['nik'] as String?)?.trim() ?? '';
    if (nik.isEmpty) {
      throw Exception('Akun belum punya NIK — hubungi HRD');
    }
    return EmployeeProfile(
      nama: (match['nama'] ?? match['username'] ?? nik).toString(),
      nik: nik,
      role: (match['role'] ?? '').toString(),
    );
  }
}
