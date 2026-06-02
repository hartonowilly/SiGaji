import 'package:shared_preferences/shared_preferences.dart';

import 'build_defaults.dart';

class AppConfig {
  static const _kApiBase = 'sigaji_api_base';
  static const _kSupabaseUrl = 'sigaji_supabase_url';
  static const _kSupabaseAnon = 'sigaji_supabase_anon';
  static const _kTenant = 'sigaji_tenant_key';

  String apiBaseUrl = '';
  String supabaseUrl = '';
  String supabaseAnonKey = '';
  String tenantKey = 'main';

  bool get isConfigured =>
      apiBaseUrl.trim().isNotEmpty &&
      supabaseUrl.trim().isNotEmpty &&
      supabaseAnonKey.trim().isNotEmpty;

  String apiEndpoint(String name) {
    var base = apiBaseUrl.trim();
    if (!base.endsWith('/')) base = '$base/';
    return '$base${name.replaceAll(RegExp(r'^/'), '')}';
  }

  static Future<AppConfig> load() async {
    final p = await SharedPreferences.getInstance();
    final c = AppConfig();
    c.apiBaseUrl = p.getString(_kApiBase) ?? '';
    c.supabaseUrl = p.getString(_kSupabaseUrl) ?? '';
    c.supabaseAnonKey = p.getString(_kSupabaseAnon) ?? '';
    c.tenantKey = (p.getString(_kTenant) ?? 'main').trim().isEmpty
        ? 'main'
        : (p.getString(_kTenant) ?? 'main').trim();
    if (!c.isConfigured) {
      if (c.apiBaseUrl.isEmpty && BuildDefaults.apiBaseUrl.isNotEmpty) {
        c.apiBaseUrl = BuildDefaults.apiBaseUrl;
      }
      if (c.supabaseUrl.isEmpty && BuildDefaults.supabaseUrl.isNotEmpty) {
        c.supabaseUrl = BuildDefaults.supabaseUrl;
      }
      if (c.supabaseAnonKey.isEmpty && BuildDefaults.supabaseAnonKey.isNotEmpty) {
        c.supabaseAnonKey = BuildDefaults.supabaseAnonKey;
      }
      if (BuildDefaults.tenantKey.isNotEmpty) {
        c.tenantKey = BuildDefaults.tenantKey;
      }
    }
    return c;
  }

  Future<void> save() async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kApiBase, apiBaseUrl.trim());
    await p.setString(_kSupabaseUrl, supabaseUrl.trim());
    await p.setString(_kSupabaseAnon, supabaseAnonKey.trim());
    await p.setString(_kTenant, tenantKey.trim().isEmpty ? 'main' : tenantKey.trim());
  }
}
