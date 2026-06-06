import 'dart:io';

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import 'input_image_helper.dart';

/// Anti-spoof: foto di layar HP/PC tidak bisa "kedip".
class BlinkLivenessResult {
  const BlinkLivenessResult({required this.ok, this.error, this.face});

  final bool ok;
  final String? error;
  final Face? face;
}

class FaceLiveness {
  FaceLiveness(this._detector);

  final FaceDetector _detector;

  /// ML Kit sering lapor >0.9 untuk mata normal — jangan pakai batas atas.
  static const minEyeOpen = 0.32;
  static const blinkDropMin = 0.22;

  Future<BlinkLivenessResult> checkEyesOpen(File file) async {
    final face = await _singleFace(file);
    if (!face.ok) return BlinkLivenessResult(ok: false, error: face.error);

    final f = face.face!;
    final err = _poseAndEyesError(f, requireOpen: true);
    if (err != null) {
      return BlinkLivenessResult(ok: false, error: err);
    }
    return BlinkLivenessResult(ok: true, face: f);
  }

  Future<BlinkLivenessResult> checkBlink(File file, Face priorOpenFace) async {
    final face = await _singleFace(file);
    if (!face.ok) return BlinkLivenessResult(ok: false, error: face.error);

    final f = face.face!;
    if (_poseError(f) != null) {
      return BlinkLivenessResult(ok: false, error: _poseError(f));
    }

    final left = f.leftEyeOpenProbability;
    final right = f.rightEyeOpenProbability;
    if (left == null || right == null) {
      return BlinkLivenessResult(
        ok: false,
        error: 'Mata tidak terbaca — hadap kamera',
      );
    }

    final openNow = (left + right) / 2;
    final priorLeft = priorOpenFace.leftEyeOpenProbability;
    final priorRight = priorOpenFace.rightEyeOpenProbability;
    final openBefore = priorLeft != null && priorRight != null
        ? (priorLeft + priorRight) / 2
        : 1.0;

    if (openNow > 0.42) {
      return const BlinkLivenessResult(
        ok: false,
        error: 'Kedipkan mata — mata masih terbuka (jangan foto layar)',
      );
    }
    if (openBefore - openNow < blinkDropMin) {
      return const BlinkLivenessResult(
        ok: false,
        error: 'Kedipkan jelas — bukan foto statis di layar',
      );
    }

    return BlinkLivenessResult(ok: true, face: f);
  }

  Future<({bool ok, Face? face, String? error})> _singleFace(File file) async {
    final decoded = await InputImageHelper.loadOrientedImage(
      file,
      frontCamera: true,
    );
    if (decoded == null) {
      return (ok: false, face: null, error: 'Gambar tidak bisa dibaca');
    }
    final faces = await _detector.processImage(
      InputImageHelper.fromRgbImage(decoded),
    );
    if (faces.isEmpty) {
      return (ok: false, face: null, error: 'Wajah tidak terdeteksi');
    }
    if (faces.length > 1) {
      return (ok: false, face: null, error: 'Hanya satu wajah dalam frame');
    }
    return (ok: true, face: faces.first, error: null);
  }

  String? _poseAndEyesError(Face f, {required bool requireOpen}) {
    final pose = _poseError(f);
    if (pose != null) return pose;

    final left = f.leftEyeOpenProbability;
    final right = f.rightEyeOpenProbability;
    if (left == null || right == null) {
      return 'Mata tidak terbaca — cukup cahaya';
    }
    final avg = (left + right) / 2;
    if (requireOpen && avg < minEyeOpen) {
      return 'Buka mata — pastikan wajah & mata terlihat jelas';
    }
    return null;
  }

  String? _poseError(Face f) {
    if (f.headEulerAngleY != null && f.headEulerAngleY!.abs() > 15) {
      return 'Hadap kamera lurus';
    }
    if (f.headEulerAngleZ != null && f.headEulerAngleZ!.abs() > 12) {
      return 'Jangan miringkan kepala';
    }
    return null;
  }
}
