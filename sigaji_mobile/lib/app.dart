import 'package:flutter/material.dart';

import 'config/app_config.dart';
import 'theme/sigaji_theme.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/setup_screen.dart';
import 'services/auth_service.dart';
class SigajiApp extends StatefulWidget {
  const SigajiApp({super.key});

  @override
  State<SigajiApp> createState() => _SigajiAppState();
}

class _SigajiAppState extends State<SigajiApp> {
  AppConfig? _config;
  bool _loading = true;
  String? _bootError;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    try {
      final c = await AppConfig.load();
      setState(() {
        _config = c;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _bootError = e.toString();
        _loading = false;
      });
    }
  }

  void _onConfigSaved(AppConfig c) {
    setState(() => _config = c);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SiGaji Absen',
      debugShowCheckedModeBanner: false,
      theme: sigajiTheme(),
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_bootError != null) {
      return Scaffold(
        body: Center(child: Text('Error: $_bootError')),
      );
    }
    final config = _config!;
    if (!config.isConfigured) {
      return SetupScreen(config: config, onSaved: _onConfigSaved);
    }
    return _AuthGate(config: config, onReconfigure: () {
      setState(() {
        _config = AppConfig()..apiBaseUrl = config.apiBaseUrl;
      });
    });
  }
}

class _AuthGate extends StatefulWidget {
  const _AuthGate({required this.config, required this.onReconfigure});

  final AppConfig config;
  final VoidCallback onReconfigure;

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  bool _loading = true;
  bool _loggedIn = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final auth = AuthService(widget.config);
      await auth.initSupabase();
      setState(() {
        _loggedIn = auth.hasSession;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('SiGaji Absen')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Text(_error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: widget.onReconfigure,
                child: const Text('Ubah konfigurasi server'),
              ),
            ],
          ),
        ),
      );
    }
    if (!_loggedIn) {
      return LoginScreen(
        config: widget.config,
        onLoggedIn: () => setState(() => _loggedIn = true),
        onSetup: widget.onReconfigure,
      );
    }
    return HomeScreen(
      config: widget.config,
      onLogout: () => setState(() => _loggedIn = false),
      onSetup: widget.onReconfigure,
    );
  }
}
