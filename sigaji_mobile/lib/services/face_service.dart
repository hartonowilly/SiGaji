import '../config/app_config.dart';
import 'api_client.dart';
import 'face_verify_service.dart';

class FaceEnrollmentStatus {
  FaceEnrollmentStatus.fromJson(Map<String, dynamic> j)
      : ok = j['ok'] == true,
        enrolled = j['enrolled'] == true,
        modelVersion = j['model_version']?.toString(),
        enrolledAt = j['enrolled_at']?.toString(),
        needsReenroll = j['needs_reenroll'] == true,
        error = j['error']?.toString();

  final bool ok;
  final bool enrolled;
  final String? modelVersion;
  final String? enrolledAt;
  final bool needsReenroll;
  final String? error;
}

class EnrolledFaceProfile {
  EnrolledFaceProfile({
    required this.embedding,
    required this.modelVersion,
    required this.verifyThreshold,
  });

  final List<double> embedding;
  final String modelVersion;
  final double verifyThreshold;
}

class FaceService {
  FaceService(this.config);

  final AppConfig config;
  ApiClient get _api => ApiClient(config);

  EnrolledFaceProfile? _cached;

  void clearCache() => _cached = null;

  Future<FaceEnrollmentStatus> status() async {
    final j = await _api.post('mobile-face', {'action': 'status'});
    return FaceEnrollmentStatus.fromJson(j ?? {'ok': false, 'error': 'Gagal'});
  }

  Future<EnrolledFaceProfile> loadProfile({bool forceRefresh = false}) async {
    if (!forceRefresh && _cached != null) return _cached!;

    final j = await _api.post('mobile-face', {'action': 'get_embedding'});
    if (j == null || j['ok'] != true) {
      throw Exception(
        j?['error']?.toString() ?? 'Belum daftar wajah — lakukan enrollment',
      );
    }

    final model = j['model_version']?.toString() ?? '';
    if (model != FaceVerifyService.modelVersion) {
      throw Exception(
        'Model wajah usang ($model) — daftar ulang wajah di app terbaru',
      );
    }

    final raw = j['embedding'];
    if (raw is! List) {
      throw Exception('Data wajah tidak valid — daftar ulang');
    }

    final threshold = (j['verify_threshold'] as num?)?.toDouble() ??
        FaceVerifyService.matchThresholdFloor;

    _cached = EnrolledFaceProfile(
      embedding: raw.map((e) => (e as num).toDouble()).toList(),
      modelVersion: model,
      verifyThreshold: threshold,
    );
    return _cached!;
  }

  Future<String> enroll({
    required List<double> embedding,
    required double minSelfScore,
    required double verifyThreshold,
    required String photoPath,
  }) async {
    final j = await _api.post('mobile-face', {
      'action': 'enroll',
      'embedding': embedding,
      'model_version': FaceVerifyService.modelVersion,
      'enroll_min_self_score': minSelfScore,
      'verify_threshold': verifyThreshold,
      'photo_path': photoPath,
    });
    if (j == null || j['ok'] != true) {
      throw Exception(j?['error']?.toString() ?? 'Gagal simpan enrollment');
    }
    _cached = EnrolledFaceProfile(
      embedding: embedding,
      modelVersion: FaceVerifyService.modelVersion,
      verifyThreshold: verifyThreshold,
    );
    return j['message']?.toString() ?? 'Wajah terdaftar';
  }
}
