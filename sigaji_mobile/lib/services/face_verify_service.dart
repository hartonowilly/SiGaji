import 'dart:io';
import 'dart:math' as math;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

class _LmPoint {
  const _LmPoint(this.x, this.y);
  final double x;
  final double y;
}

class FaceVerifyResult {
  const FaceVerifyResult({
    required this.ok,
    this.score,
    this.error,
    this.embedding,
  });

  final bool ok;
  final double? score;
  final String? error;
  final List<double>? embedding;
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

/// Validasi wajah on-device — tidak mengunggah foto ke server.
class FaceVerifyService {
  /// v2: landmark + tekstur LBP (lebih ketat dari landmark_v1).
  static const matchThresholdFloor = 0.88;
  static const enrollMinSelfFloor = 0.86;
  static const verifyMarginBelowEnroll = 0.05;
  static const modelVersion = 'lbp_v2';
  static const enrollSamples = 3;

  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(
      enableLandmarks: true,
      enableClassification: true,
      performanceMode: FaceDetectorMode.accurate,
      minFaceSize: 0.18,
    ),
  );

  Future<void> dispose() => _detector.close();

  Future<FaceVerifyResult> extractEmbedding(File file) async {
    final face = await _detectSingleFace(file);
    if (!face.ok || face.face == null || face.image == null) {
      return FaceVerifyResult(ok: false, error: face.error);
    }

    final embedding = _computeEmbedding(face.face!, face.image!);
    if (embedding.every((v) => v == 0)) {
      return const FaceVerifyResult(
        ok: false,
        error: 'Wajah kurang jelas — coba lagi di ruang terang',
      );
    }

    return FaceVerifyResult(ok: true, embedding: embedding);
  }

  /// Gabungkan 3 sampel enrollment + hitung ambang personal.
  EnrollQualityResult finalizeEnrollment(List<List<double>> samples) {
    if (samples.length < enrollSamples) {
      return EnrollQualityResult(
        ok: false,
        error: 'Butuh $enrollSamples foto wajah',
      );
    }
    for (final s in samples) {
      if (s.length != samples.first.length) {
        return const EnrollQualityResult(
          ok: false,
          error: 'Sampel tidak konsisten — ulangi dari awal',
        );
      }
    }

    var minSelf = 1.0;
    for (var i = 0; i < samples.length; i++) {
      for (var j = i + 1; j < samples.length; j++) {
        final s = _cosine(samples[i], samples[j]);
        if (s < minSelf) minSelf = s;
      }
    }

    if (minSelf < enrollMinSelfFloor) {
      return EnrollQualityResult(
        ok: false,
        error:
            'Foto enrollment kurang konsisten (${(minSelf * 100).toStringAsFixed(0)}%). '
            'Pakai pencahayaan sama & hadap kamera lurus.',
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
    final score = _cosine(enrolled, live);
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
      _detectSingleFace(File file) async {
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
    if (face.headEulerAngleY != null &&
        face.headEulerAngleY!.abs() > 18) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Hadap kamera lurus (jangan miring)',
      );
    }

    final leftEye = face.leftEyeOpenProbability;
    final rightEye = face.rightEyeOpenProbability;
    if (leftEye != null &&
        rightEye != null &&
        (leftEye < 0.3 || rightEye < 0.3)) {
      return (
        ok: false,
        face: null,
        image: null,
        error: 'Buka mata dan hadap kamera',
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

  List<double> _computeEmbedding(Face face, img.Image rgb) {
    final ratios = _landmarkRatios(face);
    final lbp = _lbpHistogram(face, rgb);
    return _l2normalize([...ratios, ...lbp]);
  }

  List<double> _landmarkRatios(Face face) {
    final leftEye = _lm(face, FaceLandmarkType.leftEye);
    final rightEye = _lm(face, FaceLandmarkType.rightEye);
    final nose = _lm(face, FaceLandmarkType.noseBase);
    final mouthL = _lm(face, FaceLandmarkType.leftMouth);
    final mouthR = _lm(face, FaceLandmarkType.rightMouth);
    final cheekL = _lm(face, FaceLandmarkType.leftCheek);
    final cheekR = _lm(face, FaceLandmarkType.rightCheek);

    if (leftEye == null || rightEye == null || nose == null) {
      return List<double>.filled(12, 0);
    }

    final eyeDist = _dist(leftEye, rightEye);
    if (eyeDist < 1) return List<double>.filled(12, 0);

    return [
      _dist(nose, leftEye) / eyeDist,
      _dist(nose, rightEye) / eyeDist,
      _dist(mouthL, mouthR) / eyeDist,
      _dist(nose, mouthL) / eyeDist,
      _dist(nose, mouthR) / eyeDist,
      _dist(cheekL, cheekR) / eyeDist,
      _dist(leftEye, mouthL) / eyeDist,
      _dist(rightEye, mouthR) / eyeDist,
      face.headEulerAngleY != null ? (face.headEulerAngleY! + 90) / 180 : 0.5,
      face.headEulerAngleZ != null ? (face.headEulerAngleZ! + 90) / 180 : 0.5,
      face.boundingBox.width / face.boundingBox.height,
      eyeDist / face.boundingBox.width,
    ];
  }

  /// Local Binary Pattern — tekstur kulit, lebih membedakan individu.
  List<double> _lbpHistogram(Face face, img.Image rgb) {
    final box = face.boundingBox;
    final margin = box.width * 0.08;
    var x = (box.left - margin).round().clamp(0, rgb.width - 1);
    var y = (box.top - margin).round().clamp(0, rgb.height - 1);
    var w = (box.width + margin * 2).round().clamp(1, rgb.width - x);
    var h = (box.height + margin * 2).round().clamp(1, rgb.height - y);

    final crop = img.copyCrop(rgb, x: x, y: y, width: w, height: h);
    final gray = img.grayscale(img.copyResize(crop, width: 64, height: 64));

    final hist = List<double>.filled(59, 0);
    const offsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
      [1, 0],
      [1, -1],
      [0, -1],
    ];

    for (var py = 1; py < 63; py++) {
      for (var px = 1; px < 63; px++) {
        final c = gray.getPixel(px, py).r;
        var code = 0;
        for (var k = 0; k < 8; k++) {
          final nx = px + offsets[k][0];
          final ny = py + offsets[k][1];
          if (gray.getPixel(nx, ny).r >= c) code |= 1 << k;
        }
        hist[code % 59] += 1;
      }
    }

    final total = hist.fold<double>(0, (a, b) => a + b);
    if (total <= 0) return hist;
    return hist.map((v) => v / total).toList();
  }

  _LmPoint? _lm(Face face, FaceLandmarkType type) {
    final lm = face.landmarks[type];
    if (lm == null) return null;
    final p = lm.position;
    return _LmPoint(p.x.toDouble(), p.y.toDouble());
  }

  double _dist(_LmPoint? a, _LmPoint? b) {
    if (a == null || b == null) return 0;
    final dx = a.x - b.x;
    final dy = a.y - b.y;
    return math.sqrt(dx * dx + dy * dy);
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

  double _cosine(List<double> a, List<double> b) {
    var dot = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}
