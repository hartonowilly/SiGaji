import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';
import '../services/attendance_service.dart';
import '../services/face_service.dart';
import '../services/face_verify_service.dart';
import '../services/integrity_service.dart';
import '../theme/sigaji_theme.dart';
import '../widgets/front_camera_preview.dart';

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
  bool _loadingGps = true;
  bool _mockWarning = false;
  String? _loadError;
  String? _gpsError;
  GpsPreview? _gpsPreview;
  Position? _position;
  EnrolledFaceProfile? _profile;
  CameraController? _camera;
  final _picker = ImagePicker();
  final _verify = FaceVerifyService();
  final _integrity = IntegrityService();
  double? _faceScore;
  String? _faceScoreError;
  bool _verifyingFace = false;

  String get _title =>
      widget.eventType == 'check_out' ? 'Check-out' : 'Check-in';

  @override
  void initState() {
    super.initState();
    _loadEnrollment();
    _refreshGps();
    _checkIntegrity();
  }

  @override
  void dispose() {
    _camera?.dispose();
    _verify.dispose();
    super.dispose();
  }

  Future<void> _checkIntegrity() async {
    final i = await _integrity.check();
    if (!mounted) return;
    setState(() => _mockWarning = i['mock_location_enabled'] == true);
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

  Future<void> _refreshGps() async {
    setState(() {
      _loadingGps = true;
      _gpsError = null;
    });
    try {
      final pos = await AttendanceService(widget.config).getGps();
      final preview = await AttendanceService(widget.config).gpsPreview(pos);
      if (!mounted) return;
      setState(() {
        _position = pos;
        _gpsPreview = preview;
        _loadingGps = false;
        _mockWarning = _mockWarning || pos.isMocked;
        if (!preview.ok) _gpsError = preview.error ?? 'GPS gagal';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _gpsError = e.toString().replaceFirst('Exception: ', '');
        _loadingGps = false;
      });
    }
  }

  Future<void> _openMaps() async {
    final lat = _gpsPreview?.nearestLat;
    final lon = _gpsPreview?.nearestLon;
    if (lat == null || lon == null) return;
    final url = Uri.parse('https://www.google.com/maps?q=$lat,$lon');
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      _snack('Tidak bisa membuka Maps');
    }
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

  Future<void> _deleteFile(File? f) async {
    try {
      await f?.delete();
    } catch (_) {}
  }

  Future<void> _verifyFace() async {
    if (_profile == null) {
      _snack('Belum daftar wajah');
      return;
    }
    final cam = await Permission.camera.request();
    if (!cam.isGranted) {
      _snack('Izin kamera diperlukan');
      return;
    }
    setState(() {
      _verifyingFace = true;
      _faceScore = null;
      _faceScoreError = null;
    });
    File? photo;
    try {
      photo = await _capturePhoto();
      if (photo == null) return;
      final extracted = await _verify.extractEmbedding(
        photo,
        forVerification: true,
      );
      if (!extracted.ok || extracted.embedding == null) {
        HapticFeedback.heavyImpact();
        setState(() => _faceScoreError = extracted.error ?? 'Validasi wajah gagal');
        return;
      }
      final matched = _verify.match(
        _profile!.embedding,
        extracted.embedding!,
        personalThreshold: _profile!.verifyThreshold,
      );
      if (!matched.ok || matched.score == null) {
        HapticFeedback.heavyImpact();
        setState(() => _faceScoreError = matched.error ?? 'Wajah tidak cocok');
        return;
      }
      HapticFeedback.lightImpact();
      setState(() => _faceScore = matched.score);
    } finally {
      await _deleteFile(photo);
      if (mounted) setState(() => _verifyingFace = false);
    }
  }

  Future<void> _submit() async {
    if (_profile == null) {
      _snack('Belum daftar wajah');
      return;
    }
    if (_gpsPreview != null && !_gpsPreview!.canSubmit) {
      HapticFeedback.heavyImpact();
      _snack(_gpsPreview!.message.isNotEmpty
          ? _gpsPreview!.message
          : 'Di luar radius lokasi kerja');
      return;
    }
    final threshold = _profile!.verifyThreshold;
    final score = _faceScore;
    if (score == null || score < threshold) {
      _snack('Verifikasi wajah dulu (min ${(threshold * 100).round()}%)');
      return;
    }

    setState(() => _busy = true);
    try {
      final svc = AttendanceService(widget.config);
      final msg = await svc.submitEvent(
        eventType: widget.eventType,
        faceScore: score,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      Navigator.pop(context, true);
    } catch (e) {
      HapticFeedback.heavyImpact();
      _snack(e.toString().replaceFirst('Exception: ', ''));
      await _refreshGps();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String t) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));
  }

  Widget _gpsFailCard() {
    final p = _gpsPreview;
    final dist = p?.distanceLabel ?? '—';
    final name = p?.nearestName ?? 'Lokasi terdekat';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFDEAEA),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8B4B4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.location_off, color: SigajiColors.error),
              SizedBox(width: 8),
              Text(
                'GPS di luar radius',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  color: SigajiColors.error,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '$name — jarak $dist',
            style: const TextStyle(fontSize: 15),
          ),
          if (p?.radiusLabel != null)
            Text(
              'Radius diizinkan: ${p!.radiusLabel}',
              style: const TextStyle(fontSize: 14, color: Colors.black54),
            ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _openMaps,
            icon: const Icon(Icons.map_outlined),
            label: const Text('Buka Maps'),
          ),
          TextButton(onPressed: _refreshGps, child: const Text('Perbarui GPS')),
        ],
      ),
    );
  }

  Widget _gpsCard() {
    if (_loadingGps) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(14),
          child: Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 12),
              Text('Memuat GPS…', style: TextStyle(fontSize: 15)),
            ],
          ),
        ),
      );
    }
    if (_gpsError != null && (_gpsPreview == null || !_gpsPreview!.ok)) {
      return _gpsFailCard();
    }
    final p = _gpsPreview;
    final acc = _position?.accuracy;
    final inside = p?.inside == true;
    if (p != null && p.ok && !p.canSubmit) {
      return _gpsFailCard();
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: inside ? const Color(0xFFE8F4DE) : const Color(0xFFFFF0E0),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: inside ? const Color(0xFFB8D9A0) : const Color(0xFFE8C9A0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                inside ? Icons.gps_fixed : Icons.gps_not_fixed,
                color: inside ? SigajiColors.success : SigajiColors.warn,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  p?.message ?? 'GPS',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
            ],
          ),
          if (acc != null) ...[
            const SizedBox(height: 6),
            Text(
              'Akurasi GPS ±${acc.round()} m',
              style: const TextStyle(fontSize: 14, color: Colors.black54),
            ),
          ],
          if (_mockWarning) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber, color: SigajiColors.warn, size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Mock GPS terdeteksi — matikan fake GPS',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],
          TextButton(onPressed: _busy ? null : _refreshGps, child: const Text('Perbarui lokasi')),
        ],
      ),
    );
  }

  Widget _faceScoreBar() {
    final threshold = _profile?.verifyThreshold ?? 0.76;
    final score = _faceScore;
    if (_faceScoreError != null) {
      return Text(
        _faceScoreError!,
        style: const TextStyle(color: SigajiColors.error, fontSize: 14),
      );
    }
    if (score == null) {
      return Text(
        'Min skor ${(threshold * 100).round()}% untuk submit',
        style: const TextStyle(fontSize: 14, color: Colors.black54),
      );
    }
    final pct = (score * 100).clamp(0, 100);
    final ok = score >= threshold;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Skor wajah', style: TextStyle(fontWeight: FontWeight.w700)),
            Text(
              '${pct.round()}%',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: ok ? SigajiColors.success : SigajiColors.error,
                fontSize: 16,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: score.clamp(0.0, 1.0),
            minHeight: 10,
            backgroundColor: SigajiColors.brandLight,
            color: ok ? SigajiColors.success : SigajiColors.error,
          ),
        ),
      ],
    );
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
              Icon(Icons.face_outlined, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(_loadError!, style: const TextStyle(color: Colors.red, fontSize: 15)),
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

    final canSubmit = _gpsPreview?.canSubmit != false &&
        _faceScore != null &&
        _faceScore! >= (_profile?.verifyThreshold ?? 0.76);

    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        backgroundColor: SigajiColors.brand,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _gpsCard(),
            const SizedBox(height: 16),
            const Text(
              'Preview kamera',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 8),
            FrontCameraPreview(
              onReady: (c) {
                if (mounted) setState(() => _camera = c);
              },
            ),
            const SizedBox(height: 12),
            _faceScoreBar(),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: (_busy || _verifyingFace) ? null : _verifyFace,
              icon: _verifyingFace
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.face_retouching_natural),
              label: Text(_verifyingFace ? 'Memverifikasi…' : 'Verifikasi wajah'),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: (_busy || !canSubmit) ? null : _submit,
              icon: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.check_circle_outline),
              label: Text(_busy ? 'Mengirim…' : 'Kirim $_title'),
            ),
          ],
        ),
      ),
    );
  }
}
