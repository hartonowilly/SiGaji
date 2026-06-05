import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/app_config.dart';
import '../services/attendance_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, required this.config});

  final AppConfig config;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  bool _loading = true;
  List<AttendanceDayRecord> _items = [];
  int _days = 14;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await AttendanceService(widget.config).history(days: _days);
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

  String _fmtTime(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      final d = DateTime.parse(iso).toLocal();
      return DateFormat('HH:mm').format(d);
    } catch (_) {
      return iso.length >= 16 ? iso.substring(11, 16) : iso;
    }
  }

  Widget _eventTile(String label, AttendanceEvent? ev) {
    if (ev == null) {
      return Text('$label: —', style: const TextStyle(fontSize: 13));
    }
    final score = ev.faceScore != null
        ? ' · wajah ${(ev.faceScore! * 100).round()}%'
        : '';
    final loc = ev.locationNama != null ? ' · ${ev.locationNama}' : '';
    return Text(
      '$label: ${_fmtTime(ev.at)} (${ev.status ?? "?"})$loc$score',
      style: const TextStyle(fontSize: 13),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Riwayat absen'),
        actions: [
          PopupMenuButton<int>(
            initialValue: _days,
            onSelected: (v) {
              setState(() => _days = v);
              _load();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 7, child: Text('7 hari')),
              PopupMenuItem(value: 14, child: Text('14 hari')),
              PopupMenuItem(value: 30, child: Text('30 hari')),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        Center(child: Text('Belum ada riwayat absen')),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final r = _items[i];
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  r.workDate,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                _eventTile('Masuk', r.checkIn),
                                _eventTile('Pulang', r.checkOut),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
