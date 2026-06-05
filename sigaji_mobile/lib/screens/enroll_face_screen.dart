import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config/app_config.dart';
import '../services/face_service.dart';
import '../services/face_verify_service.dart';

class EnrollFaceScreen extends StatefulWidget {
  const EnrollFaceScreen({super.key, required this.config});

  final AppConfig config;

  @override
  State<EnrollFaceScreen> createState() => _EnrollFaceScreenState();
}

class _EnrollFaceScreenState extends State<EnrollFaceScreen> {
  final _picker = ImagePicker();
  final _verify = FaceVerifyService();
  final _samples = <List<double>>[];
  bool _busy = false;
  File? _lastPreview;

  @override
  void dispose() {
    _verify.dispose();
    super.dispose();
  }

  int get _need => FaceVerifyService.enrollSamples - _samples.length;

  Future<void> _captureSample() async {
    final cam = await Permission.camera.request();
    if (!cam.isGranted) {
      _snack('Izin kamera diperlukan');
      return;
    }
    final x = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 90,
    );
    if (x == null) return;

    setState(() => _busy = true);
    try {
      final file = File(x.path);
      final r = await _verify.extractEmbedding(file);
      if (!r.ok || r.embedding == null) {
        _snack(r.error ?? 'Gagal baca wajah');
        return;
      }
      setState(() {
        _samples.add(r.embedding!);
        _lastPreview = file;
      });
      if (_samples.length >= FaceVerifyService.enrollSamples) {
        _snack('Semua sampel OK — tekan Simpan');
      } else {
        _snack('Sampel ${_samples.length}/${FaceVerifyService.enrollSamples} OK');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    if (_samples.length < FaceVerifyService.enrollSamples) {
      _snack('Ambil ${FaceVerifyService.enrollSamples} foto wajah dulu');
      return;
    }
    setState(() => _busy = true);
    try {
      final quality = _verify.finalizeEnrollment(_samples);
      if (!quality.ok ||
          quality.embedding == null ||
          quality.minSelfScore == null ||
          quality.verifyThreshold == null) {
        if (_samples.length >= FaceVerifyService.enrollSamples) {
          setState(() {
            _samples.removeLast();
            _lastPreview = null;
          });
        }
        _snack(
          quality.error ??
              'Enrollment gagal — ambil ulang foto terakhir (cahaya & posisi sama)',
        );
        return;
      }
      final msg = await FaceService(widget.config).enroll(
        embedding: quality.embedding!,
        minSelfScore: quality.minSelfScore!,
        verifyThreshold: quality.verifyThreshold!,
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
    final done = _samples.length >= FaceVerifyService.enrollSamples;
    return Scaffold(
      appBar: AppBar(title: const Text('Daftar wajah')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Sekali saja per karyawan — 3 foto wajah. '
              'Pakai cahaya & jarak yang sama untuk ketiga foto. '
              'Pengecekan ketat hanya saat check-in/out nanti.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: _samples.length / FaceVerifyService.enrollSamples,
            ),
            const SizedBox(height: 8),
            Text(
              done
                  ? 'Siap simpan'
                  : 'Ambil $_need foto lagi (hadap kamera, pencahayaan cukup)',
            ),
            const SizedBox(height: 16),
            if (_lastPreview != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(_lastPreview!, height: 200, fit: BoxFit.cover),
              ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _busy || done ? null : _captureSample,
              icon: const Icon(Icons.face_retouching_natural),
              label: Text(
                _samples.isEmpty
                    ? 'Ambil foto wajah 1'
                    : 'Ambil foto wajah ${_samples.length + 1}',
              ),
            ),
            if (_samples.isNotEmpty && !done) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: _busy
                    ? null
                    : () => setState(() {
                          _samples.clear();
                          _lastPreview = null;
                        }),
                child: const Text('Ulangi dari awal'),
              ),
            ],
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
