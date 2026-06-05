import 'dart:math' as math;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

/// MobileFaceNet TFLite — embedding 192-dim (standar industri on-device).
class FaceNetEmbedder {
  FaceNetEmbedder._();
  static final FaceNetEmbedder instance = FaceNetEmbedder._();

  static const inputSize = 112;
  static const embeddingDim = 192;
  static const assetPath = 'assets/models/mobilefacenet.tflite';

  Interpreter? _interpreter;
  bool _loading = false;

  Future<void> ensureLoaded() async {
    if (_interpreter != null) return;
    if (_loading) {
      while (_loading) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
      return;
    }
    _loading = true;
    try {
      _interpreter = await Interpreter.fromAsset(assetPath);
    } finally {
      _loading = false;
    }
  }

  Future<void> dispose() async {
    _interpreter?.close();
    _interpreter = null;
  }

  Future<List<double>> embedFace(Face face, img.Image rgb) async {
    await ensureLoaded();
    final interpreter = _interpreter;
    if (interpreter == null) {
      throw Exception('Model wajah gagal dimuat');
    }

    final crop = _cropFace(face, rgb);
    final resized = img.copyResize(crop, width: inputSize, height: inputSize);
    final input = _preprocess(resized);

    final output = List.generate(1, (_) => List.filled(embeddingDim, 0.0));
    interpreter.run(input, output);

    final row = output[0];
    final raw = List<double>.generate(
      embeddingDim,
      (i) => (row[i] as num).toDouble(),
    );
    return _l2normalize(raw);
  }

  double cosineSimilarity(List<double> a, List<double> b) {
    if (a.length != b.length) return 0;
    var dot = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  double euclideanDistance(List<double> a, List<double> b) {
    var sum = 0.0;
    for (var i = 0; i < a.length; i++) {
      final d = a[i] - b[i];
      sum += d * d;
    }
    return math.sqrt(sum);
  }

  img.Image _cropFace(Face face, img.Image rgb) {
    final box = face.boundingBox;
    final margin = box.width * 0.12;
    var x = (box.left - margin).round().clamp(0, rgb.width - 1);
    var y = (box.top - margin).round().clamp(0, rgb.height - 1);
    var w = (box.width + margin * 2).round().clamp(1, rgb.width - x);
    var h = (box.height + margin * 2).round().clamp(1, rgb.height - y);
    return img.copyCrop(rgb, x: x, y: y, width: w, height: h);
  }

  List<List<List<List<double>>>> _preprocess(img.Image image) {
    final input = List.generate(
      1,
      (_) => List.generate(
        inputSize,
        (y) => List.generate(
          inputSize,
          (x) {
            final p = image.getPixel(x, y);
            return [
              (p.r - 127.5) / 128.0,
              (p.g - 127.5) / 128.0,
              (p.b - 127.5) / 128.0,
            ];
          },
        ),
      ),
    );
    return input;
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
