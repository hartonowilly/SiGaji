import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../services/attendance_service.dart';
import '../services/auth_service.dart';
import '../services/face_service.dart';
import '../services/notification_service.dart';
import 'attendance_screen.dart';
import 'enroll_face_screen.dart';
import 'leave_screen.dart';
import 'notifications_screen.dart';
import 'setup_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.config,
    required this.onLogout,
    required this.onSetup,
  });

  final AppConfig config;
  final VoidCallback onLogout;
  final VoidCallback onSetup;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  EmployeeProfile? _profile;
  DayStatus? _day;
  FaceEnrollmentStatus? _face;
  int _unread = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final auth = AuthService(widget.config);
      _profile = await auth.loadProfile();
      _day = await AttendanceService(widget.config).dayStatus();
      _face = await FaceService(widget.config).status();
      _unread = await NotificationService(widget.config).unreadCount();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    await AuthService(widget.config).signOut();
    widget.onLogout();
  }

  Color _statusColor() {
    final d = _day;
    if (d == null || !d.ok) return Colors.red.shade100;
    if (d.complete) return Colors.green.shade100;
    return Colors.amber.shade100;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SiGaji Absen'),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text(_unread > 99 ? '99+' : '$_unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => NotificationsScreen(config: widget.config),
                ),
              );
              _refresh();
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () async {
              final c = await AppConfig.load();
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => SetupScreen(
                    config: c,
                    onSaved: (_) => Navigator.pop(context),
                  ),
                ),
              );
              widget.onSetup();
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Halo, ${_profile?.nama ?? '—'}',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text(
                    'NIK: ${_profile?.nik ?? '—'}',
                    style: const TextStyle(color: Colors.black54),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _statusColor(),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _day?.statusText ?? '—',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (_face != null && !_face!.enrolled) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.orange.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Daftar wajah sekali sebelum absen',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 8),
                          FilledButton.tonal(
                            onPressed: _openEnroll,
                            child: const Text('Daftar wajah sekarang'),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: (_face?.enrolled == true && (_day?.canCheckIn ?? false))
                        ? () => _openAttendance('check_in')
                        : null,
                    icon: const Icon(Icons.login),
                    label: const Text('Check-in'),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.tonalIcon(
                    onPressed: (_face?.enrolled == true && (_day?.canCheckOut ?? false))
                        ? () => _openAttendance('check_out')
                        : null,
                    icon: const Icon(Icons.logout),
                    label: const Text('Check-out (wajib)'),
                  ),
                  if (_face?.enrolled == true) ...[
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _openEnroll,
                      icon: const Icon(Icons.face),
                      label: const Text('Daftar ulang wajah'),
                    ),
                  ],
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => LeaveScreen(config: widget.config),
                        ),
                      );
                      _refresh();
                    },
                    icon: const Icon(Icons.event_note),
                    label: const Text('Ajuan cuti / izin / sakit'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _logout,
                    child: const Text('Keluar'),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _openEnroll() async {
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => EnrollFaceScreen(config: widget.config),
      ),
    );
    if (ok == true) _refresh();
  }

  Future<void> _openAttendance(String type) async {
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => AttendanceScreen(
          config: widget.config,
          eventType: type,
        ),
      ),
    );
    if (ok == true) _refresh();
  }
}
