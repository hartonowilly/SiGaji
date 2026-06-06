import 'dart:io';

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import 'face_liveness.dart';
import 'face_net_embedder.dart';
import 'input_image_helper.dart';

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

/// MobileFaceNet on-device — enrollment 1 foto, absen 1 foto (tanpa kedip).
class FaceVerifyService {
  /// Cosine similarity pada embedding L2-normalized (MobileFaceNet).
  static const matchThresholdFloor = 0.76;
  static const modelVersion = 'mobilefacenet_v4';
  static const enrollSamples = 1;

  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(
      enableLandmarks: true,
      enableClassification: true,
      performanceMode: FaceDetectorMode.accurate,
      minFaceSize: 0.2,
    ),
  );

  final FaceNetEmbedder _net = FaceNetEmbedder.instance;

  Future<void> dispose() async {
    await _detector.close();
  }

  /// [forVerification] true = ketat (absen). false = longgar (enrollment).
  Future<FaceVerifyResult> extractEmbedding(
    File file, {
    bool forVerification = false,
  }) async {
    final face = await _detectSingleFace(file, forVerification: forVerification);
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
    if (samples.isEmpty) {
      return const EnrollQualityResult(
        ok: false,
        error: 'Butuh 1 foto wajah',
      );
    }
    final embedding = samples.first;
    if (embedding.length != FaceNetEmbedder.embeddingDim) {
      return const EnrollQualityResult(
        ok: false,
        error: 'Sampel tidak valid — ulangi enrollment',
      );
    }

    return EnrollQualityResult(
      ok: true,
      embedding: embedding,
      minSelfScore: 1.0,
      verifyThreshold: matchThresholdFloor,
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

  Future<({bool ok, Face? face, img.Image? image, String? error})>
      _detectSingleFace(
    File file, {
    bool forVerification = false,
  }) async {
    final decoded = await InputImageHelper.loadOrientedImage(file);
    if (decoded == null) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Gambar tidak bisa dibaca',
      );
    }
    final faces = await _detector.processImage(
      InputImageHelper.fromRgbImage(decoded),
    );
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
      if (forVerification) {
        if (avg < FaceLiveness.minEyeOpen) {
          return (
            ok: false,
            face: null,
            image: null,
            error: 'Buka mata — pastikan wajah terlihat jelas',
          );
        }
      } else if (avg < 0.15) {
        // Enrollment: cukup wajah & mata terbaca, tidak perlu ekspresi sempurna
        return (
          ok: false,
          face: null,
          image: null,
          error: 'Buka mata sedikit — pastikan wajah terlihat jelas',
        );
      }
    }

    final maxYaw = forVerification ? 15.0 : 22.0;
    final maxRoll = forVerification ? 12.0 : 18.0;
    if (face.headEulerAngleY != null && face.headEulerAngleY!.abs() > maxYaw) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Hadap kamera lurus',
      );
    }
    if (face.headEulerAngleZ != null && face.headEulerAngleZ!.abs() > maxRoll) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Jangan miringkan kepala',
      );
    }

    return (ok: true, face: face, image: decoded, error: null);
  }
}
