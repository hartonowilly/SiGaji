import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/app_config.dart';
import '../services/notification_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.config});

  final AppConfig config;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final svc = NotificationService(widget.config);
    _items = await svc.list();
    final hasUnread = _items.any((n) => n.isUnread);
    if (hasUnread) await svc.markAllRead();
    if (mounted) setState(() => _loading = false);
  }

  String _fmtTime(String iso) {
    try {
      final d = DateTime.parse(iso);
      return DateFormat('d MMM HH:mm').format(d.toLocal());
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifikasi')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? const Center(
                  child: Text('Belum ada notifikasi', style: TextStyle(color: Colors.black54)),
                )
              : ListView.builder(
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final n = _items[i];
                    return ListTile(
                      title: Text(n.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(n.body),
                          const SizedBox(height: 4),
                          Text(
                            _fmtTime(n.createdAt),
                            style: const TextStyle(fontSize: 12, color: Colors.black45),
                          ),
                        ],
                      ),
                      tileColor: n.isUnread ? Colors.blue.shade50 : null,
                    );
                  },
                ),
    );
  }
}
