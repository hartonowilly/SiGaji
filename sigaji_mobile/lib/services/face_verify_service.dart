import 'dart:io';
import 'dart:math' as math;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import 'face_liveness.dart';
import 'face_net_embedder.dart';

class FaceVerifyResult {
  const FaceVerifyResult({
    required this.ok,
    this.score,
    this.error,
    this.embedding,
    this.face,
  });

  final bool ok;
  final double? score;
  final String? error;
  final List<double>? embedding;
  final Face? face;
}

class EnrollQualityResult {
  const EnrollQualityResult({
    required this.ok,
    this.embedding,
    this.minSelfScore,
    this.verifyThreshold,
    this.error,
  });

  final bool ok;
  final List<double>? embedding;
  final double? minSelfScore;
  final double? verifyThreshold;
  final String? error;
}

/// MobileFaceNet + liveness kedip — validasi wajah on-device tanpa upload foto.
class FaceVerifyService {
  /// Cosine similarity pada embedding L2-normalized (MobileFaceNet).
  static const matchThresholdFloor = 0.76;
  static const enrollMinSelfFloor = 0.82;
  static const verifyMarginBelowEnroll = 0.04;
  static const modelVersion = 'mobilefacenet_v4';
  static const enrollSamples = 3;

  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(
      enableLandmarks: true,
      enableClassification: true,
      performanceMode: FaceDetectorMode.accurate,
      minFaceSize: 0.2,
    ),
  );

  late final FaceLiveness _liveness = FaceLiveness(_detector);
  final FaceNetEmbedder _net = FaceNetEmbedder.instance;

  FaceLiveness get liveness => _liveness;

  Future<void> dispose() async {
    await _detector.close();
  }

  Future<FaceVerifyResult> extractEmbedding(
    File file, {
    bool strictNeutral = false,
  }) async {
    final face = await _detectSingleFace(file, strictNeutral: strictNeutral);
    if (!face.ok || face.face == null || face.image == null) {
      return FaceVerifyResult(ok: false, error: face.error);
    }

    try {
      final embedding = await _net.embedFace(face.face!, face.image!);
      return FaceVerifyResult(
        ok: true,
        embedding: embedding,
        face: face.face,
      );
    } catch (e) {
      return FaceVerifyResult(
        ok: false,
        error: 'Model wajah error — build ulang APK: ${e.toString()}',
      );
    }
  }

  EnrollQualityResult finalizeEnrollment(List<List<double>> samples) {
    if (samples.length < enrollSamples) {
      return EnrollQualityResult(
        ok: false,
        error: 'Butuh $enrollSamples foto wajah',
      );
    }
    final dim = FaceNetEmbedder.embeddingDim;
    for (final s in samples) {
      if (s.length != dim) {
        return const EnrollQualityResult(
          ok: false,
          error: 'Sampel tidak valid — ulangi enrollment',
        );
      }
    }

    var minSelf = 1.0;
    for (var i = 0; i < samples.length; i++) {
      for (var j = i + 1; j < samples.length; j++) {
        final s = _net.cosineSimilarity(samples[i], samples[j]);
        if (s < minSelf) minSelf = s;
      }
    }

    if (minSelf < enrollMinSelfFloor) {
      return EnrollQualityResult(
        ok: false,
        error:
            'Foto enrollment kurang konsisten (${(minSelf * 100).toStringAsFixed(0)}%). '
            'Wajah normal, hadap kamera, pencahayaan cukup.',
      );
    }

    final avg = averageEmbeddings(samples);
    final threshold = math.max(
      matchThresholdFloor,
      minSelf - verifyMarginBelowEnroll,
    );

    return EnrollQualityResult(
      ok: true,
      embedding: avg,
      minSelfScore: minSelf,
      verifyThreshold: threshold,
    );
  }

  FaceVerifyResult match(
    List<double> enrolled,
    List<double> live, {
    double? personalThreshold,
  }) {
    if (enrolled.length != live.length) {
      return const FaceVerifyResult(
        ok: false,
        error: 'Model wajah usang — daftar ulang wajah di app terbaru',
      );
    }
    final threshold = personalThreshold ?? matchThresholdFloor;
    final score = _net.cosineSimilarity(enrolled, live);
    if (score < threshold) {
      return FaceVerifyResult(
        ok: false,
        score: score,
        error:
            'Wajah tidak cocok (${(score * 100).toStringAsFixed(0)}% — min ${(threshold * 100).toStringAsFixed(0)}%)',
      );
    }
    return FaceVerifyResult(ok: true, score: score);
  }

  List<double> averageEmbeddings(List<List<double>> samples) {
    if (samples.isEmpty) throw ArgumentError('samples kosong');
    final dim = samples.first.length;
    final out = List<double>.filled(dim, 0);
    for (final s in samples) {
      for (var i = 0; i < dim; i++) {
        out[i] += s[i];
      }
    }
    for (var i = 0; i < dim; i++) {
      out[i] /= samples.length;
    }
    return _l2normalize(out);
  }

  Future<({bool ok, Face? face, img.Image? image, String? error})>
      _detectSingleFace(
    File file, {
    bool strictNeutral = false,
  }) async {
    final inputImage = InputImage.fromFilePath(file.path);
    final faces = await _detector.processImage(inputImage);
    if (faces.isEmpty) {
      return (ok: false, face: null, image: null, error: 'Wajah tidak terdeteksi');
    }
    if (faces.length > 1) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Hanya satu wajah dalam frame',
      );
    }

    final face = faces.first;
    final left = face.leftEyeOpenProbability;
    final right = face.rightEyeOpenProbability;
    if (left != null && right != null) {
      final avg = (left + right) / 2;
      if (strictNeutral) {
        if (avg < FaceLiveness.minEyeOpen || avg > FaceLiveness.maxEyeOpen) {
          return (
            ok: false,
            face: null,
            image: null,
            error: 'Wajah normal saja — jangan melotot atau menutup mata',
          );
        }
      } else if (avg < 0.3) {
        return (
          ok: false,
          face: null,
          image: null,
          error: 'Buka mata dan hadap kamera',
        );
      }
    }

    if (face.headEulerAngleY != null && face.headEulerAngleY!.abs() > 15) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Hadap kamera lurus',
      );
    }

    final bytes = await file.readAsBytes();
    var decoded = img.decodeImage(bytes);
    if (decoded == null) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Gambar tidak bisa dibaca',
      );
    }
    decoded = img.bakeOrientation(decoded);
    return (ok: true, face: face, image: decoded, error: null);
  }

  List<double> _l2normalize(List<double> v) {
    var sum = 0.0;
    for (final x in v) {
      sum += x * x;
    }
    if (sum <= 1e-12) return v;
    final inv = 1 / math.sqrt(sum);
    return v.map((x) => x * inv).toList();
  }
}
