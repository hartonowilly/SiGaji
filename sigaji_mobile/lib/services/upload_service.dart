import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

class UploadService {
  UploadService(this.config);

  final AppConfig config;

  Future<String> uploadFile(File file, {String subfolder = 'attendance'}) async {
    final session = Supabase.instance.client.auth.currentSession;
    final token = session?.accessToken;
    if (token == null) throw Exception('Sesi habis');

    final uri = Uri.parse(config.apiEndpoint('mobile-upload'));
    final req = http.MultipartRequest('POST', uri);
    req.headers['authorization'] = 'Bearer $token';

    final name = file.path.split(Platform.pathSeparator).last;
    final ext = name.contains('.') ? name.split('.').last.toLowerCase() : 'jpg';
    MediaType mt;
    if (ext == 'pdf') {
      mt = MediaType('application', 'pdf');
    } else if (ext == 'png') {
      mt = MediaType('image', 'png');
    } else {
      mt = MediaType('image', 'jpeg');
    }

    req.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        filename: name,
        contentType: mt,
      ),
    );
    req.fields['subfolder'] = subfolder;

    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);

    Map<String, dynamic>? data;
    final ct = res.headers['content-type'] ?? '';
    if (ct.contains('application/json')) {
      data = jsonDecode(res.body) as Map<String, dynamic>?;
    }
    if (data != null && data['ok'] == true && data['path'] != null) {
      return data['path'].toString();
    }
    if (res.statusCode == 404) {
      throw Exception('API mobile-upload belum deploy');
    }
    final err = data?['error']?.toString() ?? 'Upload gagal (HTTP ${res.statusCode})';
    throw Exception(err);
  }
}
