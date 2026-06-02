import 'dart:io';

import '../config/app_config.dart';
import 'api_client.dart';
import 'upload_service.dart';

class LeaveItem {
  LeaveItem.fromJson(Map<String, dynamic> j)
      : id = j['id']?.toString() ?? '',
        requestType = j['request_type']?.toString() ?? '',
        dateFrom = j['date_from']?.toString() ?? '',
        dateTo = j['date_to']?.toString() ?? '',
        status = j['status']?.toString() ?? '';

  final String id;
  final String requestType;
  final String dateFrom;
  final String dateTo;
  final String status;
}

class CutiBalance {
  CutiBalance.fromJson(Map<String, dynamic>? j)
      : year = j?['year'] is int ? j!['year'] as int : int.tryParse('${j?['year']}') ?? DateTime.now().year,
        kuota = j?['kuota'] as int? ?? 12,
        sisa = j?['sisa'] as int? ?? 0,
        terpakai = j?['terpakai'] as int? ?? 0,
        pending = j?['pending_pengajuan'] as int? ?? 0;

  final int year;
  final int kuota;
  final int sisa;
  final int terpakai;
  final int pending;
}

class LeaveService {
  LeaveService(this.config);

  final AppConfig config;
  ApiClient get _api => ApiClient(config);
  UploadService get _upload => UploadService(config);

  Future<CutiBalance?> loadBalance(int year) async {
    final j = await _api.post('mobile-leave', {
      'action': 'cuti_balance',
      'year': year,
    });
    if (j == null || j['ok'] != true) return null;
    return CutiBalance.fromJson(j['balance'] as Map<String, dynamic>?);
  }

  Future<({bool allowed, String? error, int requested})> validateCuti(
    String from,
    String to,
  ) async {
    final j = await _api.post('mobile-leave', {
      'action': 'validate_cuti',
      'date_from': from,
      'date_to': to,
    });
    if (j == null || j['ok'] != true) {
      return (allowed: false, error: j?['error']?.toString() ?? 'Validasi gagal', requested: 0);
    }
    return (
      allowed: j['allowed'] == true,
      error: j['error']?.toString(),
      requested: j['requested_work_days'] as int? ?? 0,
    );
  }

  Future<List<LeaveItem>> myList() async {
    final j = await _api.post('mobile-leave', {'action': 'my_list'});
    if (j == null || j['ok'] != true) return [];
    final items = j['items'] as List<dynamic>? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(LeaveItem.fromJson)
        .toList();
  }

  Future<void> submit({
    required String requestType,
    required String dateFrom,
    required String dateTo,
    required String reason,
    File? attachment,
  }) async {
    if (dateTo.compareTo(dateFrom) < 0) {
      throw Exception('Tanggal akhir harus ≥ tanggal mulai');
    }
    String? attachmentPath;
    if (requestType == 'sakit') {
      if (attachment == null) throw Exception('Surat dokter wajib untuk sakit');
      attachmentPath = await _upload.uploadFile(attachment, subfolder: 'leave');
    }
    if (requestType == 'cuti') {
      final v = await validateCuti(dateFrom, dateTo);
      if (!v.allowed) {
        throw Exception(v.error ?? 'Cuti melebihi sisa kuota');
      }
    }
    final j = await _api.post('mobile-leave', {
      'action': 'submit',
      'request_type': requestType,
      'date_from': dateFrom,
      'date_to': dateTo,
      'reason': reason,
      if (attachmentPath != null) 'attachment_path': attachmentPath,
    });
    if (j == null || j['ok'] != true) {
      throw Exception(j?['error']?.toString() ?? 'Gagal kirim pengajuan');
    }
  }
}
