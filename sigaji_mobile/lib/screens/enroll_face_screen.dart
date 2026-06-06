import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config/app_config.dart';
import '../services/face_service.dart';
import '../services/face_verify_service.dart';
import '../services/upload_service.dart';
import '../widgets/front_camera_preview.dart';

class EnrollFaceScreen extends StatefulWidget {
  const EnrollFaceScreen({super.key, required this.config});

  final AppConfig config;

  @override
  State<EnrollFaceScreen> createState() => _EnrollFaceScreenState();
}

class _EnrollFaceScreenState extends State<EnrollFaceScreen> {
  final _picker = ImagePicker();
  final _verify = FaceVerifyService();
  CameraController? _camera;
  List<double>? _embedding;
  File? _photo;
  bool _busy = false;

  @override
  void dispose() {
    _camera?.dispose();
    _verify.dispose();
    super.dispose();
  }

  Future<File?> _capturePhoto() async {
    final c = _camera;
    if (c != null && c.value.isInitialized) {
      try {
        final x = await c.takePicture();
        return File(x.path);
      } catch (_) {}
    }
    final x = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 92,
    );
    if (x == null) return null;
    return File(x.path);
  }

  Future<void> _captureSample() async {
    final cam = await Permission.camera.request();
    if (!cam.isGranted) {
      _snack('Izin kamera diperlukan');
      return;
    }
    final file = await _capturePhoto();
    if (file == null) return;

    setState(() => _busy = true);
    try {
      final r = await _verify.extractEmbedding(
        file,
        forVerification: true,
      );
      if (!r.ok || r.embedding == null) {
        _snack(r.error ?? 'Gagal baca wajah');
        return;
      }
      setState(() {
        _embedding = r.embedding;
        _photo = file;
      });
      _snack('Foto wajah OK — tekan Simpan');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    if (_embedding == null || _photo == null) {
      _snack('Ambil 1 foto wajah dulu');
      return;
    }
    setState(() => _busy = true);
    try {
      final quality = _verify.finalizeEnrollment([_embedding!]);
      if (!quality.ok ||
          quality.embedding == null ||
          quality.minSelfScore == null ||
          quality.verifyThreshold == null) {
        _snack(quality.error ?? 'Enrollment gagal');
        return;
      }

      final photoPath = await UploadService(widget.config).uploadFile(
        _photo!,
        subfolder: 'face-enrollment',
      );

      final msg = await FaceService(widget.config).enroll(
        embedding: quality.embedding!,
        minSelfScore: quality.minSelfScore!,
        verifyThreshold: quality.verifyThreshold!,
        photoPath: photoPath,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      Navigator.pop(context, true);
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String t) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));
  }

  @override
  Widget build(BuildContext context) {
    final done = _embedding != null;
    return Scaffold(
      appBar: AppBar(title: const Text('Daftar wajah')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Sekali saja per karyawan — 1 foto wajah (terang & jelas). '
              'Foto disimpan di server; absen nanti cukup 1 foto dibandingkan MobileFaceNet.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            FrontCameraPreview(
              onReady: (c) {
                if (!mounted) return;
                setState(() => _camera = c);
              },
            ),
            const SizedBox(height: 12),
            if (_photo != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(_photo!, height: 220, fit: BoxFit.cover),
              ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _busy ? null : _captureSample,
              icon: const Icon(Icons.face_retouching_natural),
              label: Text(done ? 'Ambil ulang foto' : 'Ambil foto wajah'),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _busy || !done ? null : _save,
              child: _busy
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Simpan pendaftaran wajah'),
            ),
          ],
        ),
      ),
    );
  }
}
