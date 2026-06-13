import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../config/app_config.dart';
import '../services/attendance_service.dart';
import '../services/auth_service.dart';
import '../services/face_service.dart';
import '../services/notification_service.dart';
import '../theme/sigaji_theme.dart';
import '../widgets/progress_ring.dart';
import 'attendance_screen.dart';
import 'enroll_face_screen.dart';
import 'history_screen.dart';
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

  static const _jamMasuk = '08:00';

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

  double _dayProgress() {
    final d = _day;
    if (d == null || !d.ok) return 0;
    if (d.complete) return 1;
    if (d.hasCheckIn) return 0.5;
    return 0;
  }

  bool get _faceReady =>
      _face?.enrolled == true && _face?.needsReenroll != true;

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
    if (ok == true) {
      HapticFeedback.mediumImpact();
      _refresh();
    }
  }

  Widget _timelineStep({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool active,
    required bool done,
  }) {
    final color = done
        ? SigajiColors.success
        : active
            ? SigajiColors.brand
            : Colors.grey.shade400;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: done
                    ? SigajiColors.brandLight
                    : active
                        ? SigajiColors.brand.withValues(alpha: 0.12)
                        : Colors.grey.shade100,
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 2),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            if (title != 'Pulang')
              Container(width: 2, height: 28, color: Colors.grey.shade300),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: active || done ? SigajiColors.brand : Colors.black54,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 14, color: Colors.black54),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final d = _day;
    final progress = _dayProgress();

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(
        backgroundColor: SigajiColors.brand,
        foregroundColor: Colors.white,
        title: const Text('SiGaji Absen', style: TextStyle(fontSize: 18)),
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
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: SigajiColors.brand,
                    ),
                  ),
                  Text(
                    'NIK: ${_profile?.nik ?? '—'}',
                    style: const TextStyle(fontSize: 15, color: Colors.black54),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    elevation: 0,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: SigajiColors.brand.withValues(alpha: 0.15)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          ProgressRing(progress: progress, child: null),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  d?.statusText ?? '—',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Hari ini · ${d?.workDate ?? '—'}',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Colors.black54,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    elevation: 0,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Timeline hari ini',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: SigajiColors.brand,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _timelineStep(
                            icon: Icons.schedule,
                            title: 'Target masuk',
                            subtitle: 'Jam masuk $_jamMasuk',
                            active: !(d?.hasCheckIn ?? false),
                            done: false,
                          ),
                          _timelineStep(
                            icon: Icons.login,
                            title: 'Check-in',
                            subtitle: d?.hasCheckIn == true
                                ? 'Sudah absen masuk'
                                : 'Belum check-in',
                            active: !(d?.hasCheckIn ?? false) && _faceReady,
                            done: d?.hasCheckIn == true,
                          ),
                          _timelineStep(
                            icon: Icons.logout,
                            title: 'Check-out',
                            subtitle: d?.complete == true
                                ? 'Selesai'
                                : (d?.hasCheckIn == true
                                    ? 'Wajib sebelum pulang'
                                    : 'Setelah check-in'),
                            active: (d?.hasCheckIn ?? false) &&
                                !(d?.hasCheckOut ?? false),
                            done: d?.hasCheckOut == true,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_face != null &&
                      (!_face!.enrolled || _face!.needsReenroll)) ...[
                    const SizedBox(height: 12),
                    Card(
                      color: Colors.orange.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.face_retouching_natural,
                                    color: Colors.orange.shade800),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _face!.needsReenroll
                                        ? 'Perbarui daftar wajah (app terbaru)'
                                        : 'Daftar wajah sekali sebelum absen',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 15,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            FilledButton.tonal(
                              onPressed: _openEnroll,
                              child: const Text('Daftar wajah sekarang'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _faceReady && (d?.canCheckIn ?? false)
                        ? () => _openAttendance('check_in')
                        : null,
                    icon: const Icon(Icons.login),
                    label: const Text('Check-in'),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.tonalIcon(
                    onPressed: _faceReady && (d?.canCheckOut ?? false)
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
                  if (_profile?.role != 'Absen')
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
                  if (_profile?.role != 'Absen') const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => HistoryScreen(config: widget.config),
                        ),
                      );
                    },
                    icon: const Icon(Icons.history),
                    label: const Text('Riwayat absen (7–30 hari)'),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _logout,
                    child: const Text('Keluar', style: TextStyle(fontSize: 15)),
                  ),
                ],
              ),
            ),
    );
  }
}
