import '../config/app_config.dart';
import 'api_client.dart';

class NotificationItem {
  NotificationItem.fromJson(Map<String, dynamic> j)
      : id = j['id']?.toString() ?? '',
        title = j['title']?.toString() ?? '',
        body = j['body']?.toString() ?? '',
        createdAt = j['created_at']?.toString() ?? '',
        readAt = j['read_at']?.toString();

  final String id;
  final String title;
  final String body;
  final String createdAt;
  final String? readAt;

  bool get isUnread => readAt == null || readAt!.isEmpty;
}

class NotificationService {
  NotificationService(this.config);

  final AppConfig config;
  ApiClient get _api => ApiClient(config);

  Future<int> unreadCount() async {
    final j = await _api.post('mobile-notifications', {'action': 'unread_count'});
    if (j == null || j['ok'] != true) return 0;
    return j['unread'] as int? ?? 0;
  }

  Future<List<NotificationItem>> list({int limit = 50}) async {
    final j = await _api.post('mobile-notifications', {
      'action': 'list',
      'limit': limit,
    });
    if (j == null || j['ok'] != true) return [];
    final items = j['items'] as List<dynamic>? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(NotificationItem.fromJson)
        .toList();
  }

  Future<void> markAllRead() async {
    await _api.post('mobile-notifications', {'action': 'mark_read', 'all': true});
  }
}
