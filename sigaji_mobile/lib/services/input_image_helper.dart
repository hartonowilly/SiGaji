import 'dart:io' show File, Platform;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:google_mlkit_commons/google_mlkit_commons.dart';
import 'package:image/image.dart' as img;

/// Normalisasi orientasi foto (khususnya iOS kamera depan) sebelum ML Kit.
class InputImageHelper {
  static Future<img.Image?> loadOrientedImage(
    File file, {
    bool frontCamera = false,
  }) async {
    final bytes = await file.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) return null;
    var out = img.bakeOrientation(decoded);
    // Kamera depan iOS: preview cermin, file mentah tidak — samakan agar embedding konsisten.
    if (frontCamera && Platform.isIOS) {
      out = img.flipHorizontal(out);
    }
    return out;
  }

  static InputImage fromRgbImage(img.Image image) {
    final w = image.width;
    final h = image.height;
    final out = Uint8List(w * h * 4);
    var i = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        final p = image.getPixel(x, y);
        out[i++] = p.b.toInt();
        out[i++] = p.g.toInt();
        out[i++] = p.r.toInt();
        out[i++] = 255;
      }
    }
    return InputImage.fromBytes(
      bytes: out,
      metadata: InputImageMetadata(
        size: Size(w.toDouble(), h.toDouble()),
        rotation: InputImageRotation.rotation0deg,
        format: InputImageFormat.bgra8888,
        bytesPerRow: w * 4,
      ),
    );
  }
}
