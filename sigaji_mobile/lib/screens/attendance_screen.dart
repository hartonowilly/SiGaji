import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config/app_config.dart';
import '../services/attendance_service.dart';
import '../services/face_service.dart';
import '../services/face_verify_service.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({
    super.key,
    required this.config,
    required this.eventType,
  });

  final AppConfig config;
  final String eventType;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _busy = false;
  bool _loadingEmb = true;
  String? _loadError;
  EnrolledFaceProfile? _profile;
  final _picker = ImagePicker();
  final _verify = FaceVerifyService();

  String get _title =>
      widget.eventType == 'check_out' ? 'Check-out' : 'Check-in';

  @override
  void initState() {
    super.initState();
    _loadEnrollment();
  }

  @override
  void dispose() {
    _verify.dispose();
    super.dispose();
  }

  Future<void> _loadEnrollment() async {
    try {
      final profile = await FaceService(widget.config).loadProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _loadingEmb = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.toString().replaceFirst('Exception: ', '');
        _loadingEmb = false;
      });
    }
  }

  Future<void> _verifyAndSubmit() async {
    if (_profile == null) {
      _snack('Belum daftar wajah');
      return;
    }
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
    File? temp;
    try {
      temp = File(x.path);
      final extracted = await _verify.extractEmbedding(temp);
      if (!extracted.ok || extracted.embedding == null) {
        _snack(extracted.error ?? 'Validasi wajah gagal');
        return;
      }
      final matched = _verify.match(
        _profile!.embedding,
        extracted.embedding!,
        personalThreshold: _profile!.verifyThreshold,
      );
      if (!matched.ok || matched.score == null) {
        _snack(matched.error ?? 'Wajah tidak cocok');
        return;
      }

      final svc = AttendanceService(widget.config);
      final msg = await svc.submitEvent(
        eventType: widget.eventType,
        faceScore: matched.score!,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      Navigator.pop(context, true);
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      try {
        await temp?.delete();
      } catch (_) {}
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String t) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingEmb) {
      return Scaffold(
        appBar: AppBar(title: Text(_title)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(title: Text(_title)),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Text(_loadError!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Kembali — daftar wajah dulu'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Validasi wajah di HP (foto tidak diunggah) + GPS di lokasi penugasan HRD',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 24),
            const Icon(Icons.face_retouching_natural, size: 72, color: Color(0xFF1A56A0)),
            const SizedBox(height: 16),
            const Text(
              'Tekan tombol di bawah, hadap kamera depan. '
              'Foto langsung dibuang setelah cocok dengan wajah terdaftar.',
              textAlign: TextAlign.center,
            ),
            const Spacer(),
            FilledButton.icon(
              onPressed: _busy ? null : _verifyAndSubmit,
              icon: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.verified_user),
              label: Text(_busy ? 'Memproses…' : 'Verifikasi wajah & kirim $_title'),
            ),
          ],
        ),
      ),
    );
  }
}
