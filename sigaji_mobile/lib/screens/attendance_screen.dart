import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../config/app_config.dart';
import '../services/attendance_service.dart';

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
  File? _photo;
  bool _busy = false;
  final _picker = ImagePicker();

  String get _title =>
      widget.eventType == 'check_out' ? 'Check-out' : 'Check-in';

  Future<void> _takePhoto() async {
    final cam = await Permission.camera.request();
    if (!cam.isGranted) {
      _snack('Izin kamera diperlukan');
      return;
    }
    final x = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 85,
    );
    if (x != null) setState(() => _photo = File(x.path));
  }

  Future<void> _submit() async {
    if (_photo == null) {
      _snack('Ambil foto dulu');
      return;
    }
    setState(() => _busy = true);
    try {
      final svc = AttendanceService(widget.config);
      final msg = await svc.submitEvent(
        eventType: widget.eventType,
        photo: _photo!,
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
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Foto wajah + GPS di lokasi penugasan HRD',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            if (_photo != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(_photo!, height: 220, fit: BoxFit.cover),
              ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _busy ? null : _takePhoto,
              icon: const Icon(Icons.camera_alt),
              label: Text(_photo == null ? 'Ambil foto' : 'Ganti foto'),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text('Kirim $_title'),
            ),
          ],
        ),
      ),
    );
  }
}
