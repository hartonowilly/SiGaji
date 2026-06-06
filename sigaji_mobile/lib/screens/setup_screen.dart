import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../services/auth_service.dart';

class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key, required this.config, required this.onSaved});

  final AppConfig config;
  final void Function(AppConfig config) onSaved;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  late final TextEditingController _api;
  late final TextEditingController _supaUrl;
  late final TextEditingController _supaKey;
  late final TextEditingController _tenant;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _api = TextEditingController(
      text: widget.config.apiBaseUrl.isNotEmpty
          ? widget.config.apiBaseUrl
          : 'https://www.cemerlang.online/api/',
    );
    _supaUrl = TextEditingController(text: widget.config.supabaseUrl);
    _supaKey = TextEditingController(text: widget.config.supabaseAnonKey);
    _tenant = TextEditingController(
      text: widget.config.tenantKey.isNotEmpty ? widget.config.tenantKey : 'main',
    );
  }

  @override
  void dispose() {
    _api.dispose();
    _supaUrl.dispose();
    _supaKey.dispose();
    _tenant.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final oldSupaUrl = widget.config.supabaseUrl;
    final oldSupaKey = widget.config.supabaseAnonKey;
    widget.config.apiBaseUrl = _api.text.trim();
    widget.config.supabaseUrl = _supaUrl.text.trim();
    widget.config.supabaseAnonKey = _supaKey.text.trim();
    widget.config.tenantKey = _tenant.text.trim().isEmpty ? 'main' : _tenant.text.trim();
    if (!widget.config.isConfigured) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lengkapi semua field')),
      );
      setState(() => _saving = false);
      return;
    }
    final supaChanged = oldSupaUrl != widget.config.supabaseUrl ||
        oldSupaKey != widget.config.supabaseAnonKey;
    await widget.config.save();
    AuthService.resetSupabaseInit();
    if (supaChanged) {
      try {
        await Supabase.instance.client.auth.signOut();
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() => _saving = false);
    widget.onSaved(widget.config);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pengaturan server')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Isi sekali untuk APK internal. Data disimpan di HP (bukan di kode).',
            style: TextStyle(fontSize: 13, color: Colors.black54),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _api,
            decoration: const InputDecoration(
              labelText: 'URL API SiGaji',
              hintText: 'https://domain-anda.com/api/',
            ),
            keyboardType: TextInputType.url,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _supaUrl,
            decoration: const InputDecoration(
              labelText: 'Supabase URL',
              hintText: 'https://xxxx.supabase.co',
            ),
            keyboardType: TextInputType.url,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _supaKey,
            decoration: const InputDecoration(labelText: 'Supabase anon key'),
            obscureText: true,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tenant,
            decoration: const InputDecoration(
              labelText: 'Tenant key (opsional)',
              hintText: 'main',
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Simpan & lanjut'),
          ),
        ],
      ),
    );
  }
}
