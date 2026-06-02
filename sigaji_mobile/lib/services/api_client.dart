import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

class ApiClient {
  ApiClient(this.config);

  final AppConfig config;

  Future<Map<String, dynamic>?> post(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    final session = Supabase.instance.client.auth.currentSession;
    final token = session?.accessToken;
    if (token == null || token.isEmpty) {
      throw Exception('Sesi habis — login lagi');
    }
    final uri = Uri.parse(config.apiEndpoint(endpoint));
    final res = await http.post(
      uri,
      headers: {
        'authorization': 'Bearer $token',
        'content-type': 'application/json',
      },
      body: jsonEncode(body),
    );
    Map<String, dynamic>? data;
    final ct = res.headers['content-type'] ?? '';
    if (ct.contains('application/json')) {
      data = jsonDecode(res.body) as Map<String, dynamic>?;
    } else {
      return {'ok': false, 'error': 'API tidak aktif (HTTP ${res.statusCode})'};
    }
    if (data == null) return {'ok': false, 'error': 'Respons kosong'};
    if (res.statusCode >= 400 && data['error'] == null) {
      data['error'] = 'HTTP ${res.statusCode}';
      data['ok'] = false;
    }
    return data;
  }
}
