import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.config,
    required this.onLoggedIn,
    required this.onSetup,
  });

  final AppConfig config;
  final VoidCallback onLoggedIn;
  final VoidCallback onSetup;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _pw = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    _pw.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_email.text.trim().isEmpty || _pw.text.isEmpty) {
      _msg('Isi email & sandi');
      return;
    }
    setState(() => _loading = true);
    try {
      final auth = AuthService(widget.config);
      await auth.initSupabase();
      await auth.signIn(_email.text, _pw.text);
      await auth.loadProfile();
      if (!mounted) return;
      widget.onLoggedIn();
    } catch (e) {
      _msg(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _msg(String t) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF071525), Color(0xFF1A56A0)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'SiGaji Absen',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Text(
                  'Check-in foto + GPS & pengajuan cuti',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        TextField(
                          controller: _email,
                          decoration: const InputDecoration(
                            labelText: 'Email (Supabase)',
                          ),
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _pw,
                          decoration: const InputDecoration(labelText: 'Sandi'),
                          obscureText: true,
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _loading ? null : _login,
                          child: _loading
                              ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Masuk'),
                        ),
                      ],
                    ),
                  ),
                ),
                TextButton(
                  onPressed: widget.onSetup,
                  child: const Text(
                    'Ubah pengaturan server',
                    style: TextStyle(color: Colors.white70),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
