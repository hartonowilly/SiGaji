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

  Future<File?> _capture() async {
    final x = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 92,
    );
    if (x == null) return null;
    return File(x.path);
  }

  Future<void> _deleteFile(File? f) async {
    try {
      await f?.delete();
    } catch (_) {}
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

    setState(() => _busy = true);
    File? f1;
    File? f2;
    File? f3;
    try {
      // Langkah 1: wajah normal, mata terbuka
      if (!mounted) return;
      final go1 = await _confirmStep(
        'Langkah 1/3',
        'Hadap kamera — wajah normal, mata terbuka',
      );
      if (!go1) return;
      f1 = await _capture();
      if (f1 == null) return;
      final open = await _verify.liveness.checkEyesOpen(f1);
      if (!open.ok || open.face == null) {
        _snack(open.error ?? 'Langkah 1 gagal');
        return;
      }
      final priorOpen = open.face!;

      // Langkah 2: kedip (anti foto layar)
      if (!mounted) return;
      final go2 = await _confirmStep(
        'Langkah 2/3',
        'Kedipkan mata sekarang — ambil foto saat mata tertutup',
      );
      if (!go2) return;
      f2 = await _capture();
      if (f2 == null) return;
      final blink = await _verify.liveness.checkBlink(f2, priorOpen);
      if (!blink.ok) {
        _snack(blink.error ?? 'Kedip tidak terdeteksi — bukan foto layar');
        return;
      }

      // Langkah 3: verifikasi wajah
      if (!mounted) return;
      final go3 = await _confirmStep(
        'Langkah 3/3',
        'Buka mata normal lagi — verifikasi wajah',
      );
      if (!go3) return;
      f3 = await _capture();
      if (f3 == null) return;
      final extracted = await _verify.extractEmbedding(
        f3,
        forVerification: true,
      );
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
      await _deleteFile(f1);
      await _deleteFile(f2);
      await _deleteFile(f3);
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirmStep(String title, String body) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ambil foto'),
          ),
        ],
      ),
    );
    return ok == true;
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
                child: const Text('Kembali — daftar ulang wajah'),
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
              'MobileFaceNet + kedip 3 langkah. '
              'Foto layar/orang lain ditolak. Wajah normal saja.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 24),
            const Icon(Icons.face_retouching_natural, size: 72, color: Color(0xFF1A56A0)),
            const SizedBox(height: 16),
            const Text(
              'Lalu GPS di lokasi penugasan HRD. Foto tidak disimpan di server.',
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
              label: Text(_busy ? 'Memproses…' : 'Mulai verifikasi & $_title'),
            ),
          ],
        ),
      ),
    );
  }
}
