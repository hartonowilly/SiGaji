import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/app_config.dart';
import '../services/leave_service.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key, required this.config});

  final AppConfig config;

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  String _type = 'cuti';
  DateTime? _from;
  DateTime? _to;
  final _reason = TextEditingController();
  File? _attachment;
  CutiBalance? _balance;
  String? _preview;
  List<LeaveItem> _history = [];
  bool _loading = true;
  bool _submitting = false;

  LeaveService get _svc => LeaveService(widget.config);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    _history = await _svc.myList();
    if (_type == 'cuti') await _loadBalance();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadBalance() async {
    final y = _from?.year ?? DateTime.now().year;
    _balance = await _svc.loadBalance(y);
    await _updatePreview();
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _pickDate(bool isFrom) async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: isFrom ? (_from ?? now) : (_to ?? _from ?? now),
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
    );
    if (d == null) return;
    setState(() {
      if (isFrom) {
        _from = d;
        if (_to != null && _to!.isBefore(d)) _to = d;
      } else {
        _to = d;
      }
    });
    if (_type == 'cuti') await _loadBalance();
    else setState(() => _preview = null);
  }

  Future<void> _updatePreview() async {
    if (_type != 'cuti' || _from == null || _to == null) {
      setState(() => _preview = null);
      return;
    }
    if (_to!.isBefore(_from!)) {
      setState(() => _preview = 'Tanggal akhir harus ≥ tanggal mulai');
      return;
    }
    final v = await _svc.validateCuti(_fmt(_from!), _fmt(_to!));
    if (!mounted) return;
    if (v.allowed) {
      final sisa = (_balance?.sisa ?? 0) - v.requested;
      setState(() => _preview = 'Mengajukan ${v.requested} hari kerja. Sisa setelah ini: ${sisa < 0 ? 0 : sisa} hari.');
    } else {
      setState(() => _preview = v.error ?? 'Melebihi sisa cuti');
    }
  }

  Future<void> _pickFile() async {
    final r = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
    );
    if (r != null && r.files.single.path != null) {
      setState(() => _attachment = File(r.files.single.path!));
    }
  }

  Future<void> _submit() async {
    if (_from == null || _to == null) {
      _snack('Pilih tanggal');
      return;
    }
    setState(() => _submitting = true);
    try {
      await _svc.submit(
        requestType: _type,
        dateFrom: _fmt(_from!),
        dateTo: _fmt(_to!),
        reason: _reason.text.trim(),
        attachment: _attachment,
      );
      if (!mounted) return;
      _snack('Pengajuan terkirim — tunggu HRD');
      Navigator.pop(context);
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String t) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pengajuan')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_type == 'cuti' && _balance != null)
                  Card(
                    color: Colors.amber.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        'Sisa cuti ${_balance!.year}: ${_balance!.sisa} hari '
                        '(kuota ${_balance!.kuota}, terpakai ${_balance!.terpakai}'
                        '${_balance!.pending > 0 ? ', ${_balance!.pending} hari pending' : ''})',
                      ),
                    ),
                  ),
                if (_preview != null) ...[
                  const SizedBox(height: 8),
                  Text(_preview!, style: TextStyle(
                    color: _preview!.contains('Melebihi') || _preview!.contains('harus')
                        ? Colors.red.shade700
                        : Colors.green.shade800,
                    fontSize: 13,
                  )),
                ],
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: const InputDecoration(labelText: 'Jenis'),
                  items: const [
                    DropdownMenuItem(value: 'cuti', child: Text('Cuti tahunan')),
                    DropdownMenuItem(value: 'izin', child: Text('Izin')),
                    DropdownMenuItem(value: 'sakit', child: Text('Sakit (wajib surat)')),
                  ],
                  onChanged: (v) async {
                    if (v == null) return;
                    setState(() {
                      _type = v;
                      _attachment = null;
                      _preview = null;
                    });
                    if (v == 'cuti') {
                      await _loadBalance();
                    }
                  },
                ),
                ListTile(
                  title: Text(_from == null ? 'Dari tanggal' : 'Dari: ${_fmt(_from!)}'),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () => _pickDate(true),
                ),
                ListTile(
                  title: Text(_to == null ? 'Sampai tanggal' : 'Sampai: ${_fmt(_to!)}'),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () => _pickDate(false),
                ),
                TextField(
                  controller: _reason,
                  decoration: const InputDecoration(labelText: 'Alasan'),
                  maxLines: 2,
                ),
                if (_type == 'sakit') ...[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _pickFile,
                    icon: const Icon(Icons.attach_file),
                    label: Text(_attachment == null
                        ? 'Upload surat dokter'
                        : 'Surat: ${_attachment!.path.split(Platform.pathSeparator).last}'),
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Kirim pengajuan'),
                ),
                const SizedBox(height: 24),
                const Text('Riwayat', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                if (_history.isEmpty)
                  const Text('Belum ada pengajuan', style: TextStyle(color: Colors.black54))
                else
                  ..._history.map(
                    (r) => ListTile(
                      dense: true,
                      title: Text('${r.requestType} ${r.dateFrom} – ${r.dateTo}'),
                      trailing: Chip(
                        label: Text(r.status, style: const TextStyle(fontSize: 11)),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
