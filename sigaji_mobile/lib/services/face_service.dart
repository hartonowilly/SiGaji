import '../config/app_config.dart';
import 'api_client.dart';
import 'face_verify_service.dart';

class FaceEnrollmentStatus {
  FaceEnrollmentStatus.fromJson(Map<String, dynamic> j)
      : ok = j['ok'] == true,
        enrolled = j['enrolled'] == true,
        modelVersion = j['model_version']?.toString(),
        enrolledAt = j['enrolled_at']?.toString(),
        error = j['error']?.toString();

  final bool ok;
  final bool enrolled;
  final String? modelVersion;
  final String? enrolledAt;
  final String? error;
}

class FaceService {
  FaceService(this.config);

  final AppConfig config;
  ApiClient get _api => ApiClient(config);

  List<double>? _cachedEmbedding;
  String? _cachedModelVersion;

  List<double>? get cachedEmbedding => _cachedEmbedding;

  void clearCache() {
    _cachedEmbedding = null;
    _cachedModelVersion = null;
  }

  Future<FaceEnrollmentStatus> status() async {
    final j = await _api.post('mobile-face', {'action': 'status'});
    return FaceEnrollmentStatus.fromJson(j ?? {'ok': false, 'error': 'Gagal'});
  }

  Future<List<double>> loadEmbedding({bool forceRefresh = false}) async {
    if (!forceRefresh &&
        _cachedEmbedding != null &&
        _cachedEmbedding!.isNotEmpty) {
      return _cachedEmbedding!;
    }
    final j = await _api.post('mobile-face', {'action': 'get_embedding'});
    if (j == null || j['ok'] != true) {
      throw Exception(
        j?['error']?.toString() ?? 'Belum daftar wajah — lakukan enrollment',
      );
    }
    final raw = j['embedding'];
    if (raw is! List) {
      throw Exception('Data wajah tidak valid — daftar ulang');
    }
    final emb = raw.map((e) => (e as num).toDouble()).toList();
    _cachedEmbedding = emb;
    _cachedModelVersion = j['model_version']?.toString();
    return emb;
  }

  Future<String> enroll(List<double> embedding) async {
    final j = await _api.post('mobile-face', {
      'action': 'enroll',
      'embedding': embedding,
      'model_version': FaceVerifyService.modelVersion,
    });
    if (j == null || j['ok'] != true) {
      throw Exception(j?['error']?.toString() ?? 'Gagal simpan enrollment');
    }
    _cachedEmbedding = embedding;
    _cachedModelVersion = FaceVerifyService.modelVersion;
    return j['message']?.toString() ?? 'Wajah terdaftar';
  }
}
