import 'dart:io';
import 'dart:math' as math;

import 'package:google_mlkit_commons/google_mlkit_commons.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

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

/// Validasi wajah on-device — tidak mengunggah foto ke server.
class FaceVerifyService {
  static const matchThreshold = 0.72;
  static const modelVersion = 'landmark_v1';
  static const enrollSamples = 3;

  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(
      enableLandmarks: true,
      enableClassification: true,
      performanceMode: FaceDetectorMode.accurate,
      minFaceSize: 0.15,
    ),
  );

  Future<void> dispose() => _detector.close();

  Future<FaceVerifyResult> extractEmbedding(File file) async {
    final inputImage = InputImage.fromFilePath(file.path);
    final faces = await _detector.processImage(inputImage);
    if (faces.isEmpty) {
      return const FaceVerifyResult(ok: false, error: 'Wajah tidak terdeteksi');
    }
    if (faces.length > 1) {
      return const FaceVerifyResult(
        ok: false,
        error: 'Hanya satu wajah dalam frame',
      );
    }

    final face = faces.first;
    final leftEye = face.leftEyeOpenProbability;
    final rightEye = face.rightEyeOpenProbability;
    if (leftEye != null &&
        rightEye != null &&
        (leftEye < 0.25 || rightEye < 0.25)) {
      return const FaceVerifyResult(
        ok: false,
        error: 'Buka mata dan hadap kamera',
      );
    }

    final bytes = await file.readAsBytes();
    var decoded = img.decodeImage(bytes);
    if (decoded == null) {
      return const FaceVerifyResult(ok: false, error: 'Gambar tidak bisa dibaca');
    }
    decoded = img.bakeOrientation(decoded);

    final embedding = _computeEmbedding(face, decoded);
    if (embedding.every((v) => v == 0)) {
      return const FaceVerifyResult(
        ok: false,
        error: 'Wajah kurang jelas — coba lagi',
      );
    }

    return FaceVerifyResult(ok: true, embedding: embedding);
  }

  FaceVerifyResult match(List<double> enrolled, List<double> live) {
    if (enrolled.length != live.length) {
      return const FaceVerifyResult(
        ok: false,
        error: 'Model wajah tidak cocok — daftar ulang wajah',
      );
    }
    final score = _cosine(enrolled, live);
    if (score < matchThreshold) {
      return FaceVerifyResult(
        ok: false,
        score: score,
        error:
            'Wajah tidak cocok (${(score * 100).toStringAsFixed(0)}% — min ${(matchThreshold * 100).toStringAsFixed(0)}%)',
      );
    }
    return FaceVerifyResult(ok: true, score: score);
  }

  List<double> averageEmbeddings(List<List<double>> samples) {
    if (samples.isEmpty) {
      throw ArgumentError('samples kosong');
    }
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

  List<double> _computeEmbedding(Face face, img.Image rgb) {
    final ratios = _landmarkRatios(face);
    final blocks = _faceBlocks(face, rgb);
    return _l2normalize([...ratios, ...blocks]);
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

  List<double> _faceBlocks(Face face, img.Image rgb) {
    final box = face.boundingBox;
    final margin = box.width * 0.1;
    var x = (box.left - margin).round().clamp(0, rgb.width - 1);
    var y = (box.top - margin).round().clamp(0, rgb.height - 1);
    var w = (box.width + margin * 2).round().clamp(1, rgb.width - x);
    var h = (box.height + margin * 2).round().clamp(1, rgb.height - y);

    final crop = img.copyCrop(rgb, x: x, y: y, width: w, height: h);
    final resized = img.copyResize(crop, width: 48, height: 48);
    final gray = img.grayscale(resized);

    final blocks = <double>[];
    for (var by = 0; by < 8; by++) {
      for (var bx = 0; bx < 8; bx++) {
        var sum = 0.0;
        for (var py = by * 6; py < (by + 1) * 6; py++) {
          for (var px = bx * 6; px < (bx + 1) * 6; px++) {
            sum += gray.getPixel(px, py).r / 255.0;
          }
        }
        blocks.add(sum / 36);
      }
    }
    return blocks;
  }

  Point<int>? _lm(Face face, FaceLandmarkType type) {
    final lm = face.landmarks[type];
    if (lm == null) return null;
    return lm.position;
  }

  double _dist(Point<int>? a, Point<int>? b) {
    if (a == null || b == null) return 0;
    final dx = (a.x - b.x).toDouble();
    final dy = (a.y - b.y).toDouble();
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
