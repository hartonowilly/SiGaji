import 'package:geolocator/geolocator.dart';

import '../config/app_config.dart';
import 'api_client.dart';

class DayStatus {
  DayStatus.fromJson(Map<String, dynamic> j)
      : ok = j['ok'] == true,
        workDate = j['work_date']?.toString() ?? '',
        hasCheckIn = j['has_check_in'] == true,
        hasCheckOut = j['has_check_out'] == true,
        checkInStatus = j['check_in_status']?.toString(),
        checkOutStatus = j['check_out_status']?.toString(),
        canCheckIn = j['can_check_in'] != false,
        canCheckOut = j['can_check_out'] == true,
        complete = j['complete'] == true,
        error = j['error']?.toString();

  final bool ok;
  final String workDate;
  final bool hasCheckIn;
  final bool hasCheckOut;
  final String? checkInStatus;
  final String? checkOutStatus;
  final bool canCheckIn;
  final bool canCheckOut;
  final bool complete;
  final String? error;

  String get statusText {
    if (!ok) return error ?? 'Status gagal';
    if (complete) return 'Check-in & check-out selesai';
    if (checkInStatus == 'rejected') return 'Check-in ditolak — ulangi';
    if (checkInStatus == 'pending_review') return 'Check-in menunggu HRD';
    if (hasCheckIn && !hasCheckOut) return 'Sudah check-in — check-out wajib';
    if (!hasCheckIn) return 'Belum check-in';
    if (checkOutStatus == 'rejected') return 'Check-out ditolak — ulangi';
    if (checkOutStatus == 'pending_review') return 'Check-out menunggu HRD';
    return 'Status hari ini';
  }
}

class AttendanceService {
  AttendanceService(this.config);

  final AppConfig config;
  ApiClient get _api => ApiClient(config);

  Future<DayStatus> dayStatus() async {
    final j = await _api.post('mobile-attendance', {'action': 'day_status'});
    return DayStatus.fromJson(j ?? {'ok': false, 'error': 'Gagal'});
  }

  Future<Position> getGps() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied ||
        perm == LocationPermission.deniedForever) {
      throw Exception('Izin lokasi ditolak — aktifkan GPS di pengaturan');
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('GPS perangkat mati — nyalakan lokasi');
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 25),
      ),
    );
  }

  Future<String> submitEvent({
    required String eventType,
    required double faceScore,
  }) async {
    final pos = await getGps();
    final j = await _api.post('mobile-attendance', {
      'action': eventType,
      'lat': pos.latitude,
      'lon': pos.longitude,
      'accuracy_m': pos.accuracy,
      'is_mock': pos.isMocked,
      'face_verified': true,
      'face_score': faceScore,
      'device_id': 'flutter-sigaji-mobile',
    });
    if (j == null || j['ok'] != true) {
      var err = j?['error']?.toString() ?? 'Gagal simpan';
      if (j?['retry'] == true) err = '$err — silakan coba lagi';
      throw Exception(err);
    }
    return j['message']?.toString() ?? 'Berhasil';
  }
}
