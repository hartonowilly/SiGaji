import 'package:geolocator/geolocator.dart';

import '../config/app_config.dart';
import 'api_client.dart';
import 'integrity_service.dart';

class GpsPreview {
  GpsPreview.fromJson(Map<String, dynamic> j)
      : ok = j['ok'] == true,
        message = j['message']?.toString() ?? '',
        canSubmit = j['can_submit'] == true,
        inside = j['nearest'] is Map && (j['nearest']['inside'] == true),
        nearestName = j['nearest'] is Map
            ? j['nearest']['nama']?.toString()
            : null,
        distanceLabel = j['nearest'] is Map
            ? j['nearest']['distance_label']?.toString()
            : null,
        radiusLabel = j['nearest'] is Map
            ? j['nearest']['radius_label']?.toString()
            : null,
        nearestLat = j['nearest'] is Map
            ? (j['nearest']['lat'] as num?)?.toDouble()
            : null,
        nearestLon = j['nearest'] is Map
            ? (j['nearest']['lon'] as num?)?.toDouble()
            : null,
        error = j['error']?.toString();

  final bool ok;
  final String message;
  final bool canSubmit;
  final bool inside;
  final String? nearestName;
  final String? distanceLabel;
  final String? radiusLabel;
  final double? nearestLat;
  final double? nearestLon;
  final String? error;
}

class AttendanceDayRecord {
  AttendanceDayRecord.fromJson(Map<String, dynamic> j)
      : workDate = j['work_date']?.toString() ?? '',
        checkIn = j['check_in'] is Map
            ? AttendanceEvent.fromJson(j['check_in'] as Map<String, dynamic>)
            : null,
        checkOut = j['check_out'] is Map
            ? AttendanceEvent.fromJson(j['check_out'] as Map<String, dynamic>)
            : null;

  final String workDate;
  final AttendanceEvent? checkIn;
  final AttendanceEvent? checkOut;
}

class AttendanceEvent {
  AttendanceEvent.fromJson(Map<String, dynamic> j)
      : at = j['at']?.toString(),
        status = j['status']?.toString(),
        locationNama = j['location_nama']?.toString(),
        faceScore = j['face_score'] != null
            ? (j['face_score'] as num).toDouble()
            : null,
        distanceM = j['distance_m'] as int?;

  final String? at;
  final String? status;
  final String? locationNama;
  final double? faceScore;
  final int? distanceM;
}

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
  final _integrity = IntegrityService();
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

  Future<GpsPreview> gpsPreview(Position pos) async {
    final j = await _api.post('mobile-attendance', {
      'action': 'gps_preview',
      'lat': pos.latitude,
      'lon': pos.longitude,
    });
    return GpsPreview.fromJson(j ?? {'ok': false, 'error': 'Gagal preview GPS'});
  }

  Future<List<AttendanceDayRecord>> history({int days = 14}) async {
    final j = await _api.post('mobile-attendance', {
      'action': 'history',
      'days': days,
    });
    if (j == null || j['ok'] != true) return [];
    final items = j['items'] as List<dynamic>? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(AttendanceDayRecord.fromJson)
        .toList();
  }

  Future<String> submitEvent({
    required String eventType,
    required double faceScore,
  }) async {
    final pos = await getGps();
    final integrity = await _integrity.check();
    final mocked = _integrity.shouldRejectGps(
      positionMocked: pos.isMocked,
      integrity: integrity,
    );
    final j = await _api.post('mobile-attendance', {
      'action': eventType,
      'lat': pos.latitude,
      'lon': pos.longitude,
      'accuracy_m': pos.accuracy,
      'is_mock': mocked,
      'face_verified': true,
      'face_score': faceScore,
      'device_id': 'flutter-sigaji-mobile',
      'integrity_flags': integrity,
    });
    if (j == null || j['ok'] != true) {
      var err = j?['error']?.toString() ?? 'Gagal simpan';
      if (j?['nearest'] is Map) {
        final n = j!['nearest'] as Map;
        final dl = n['distance_label']?.toString();
        final rl = n['radius_label']?.toString();
        final nama = n['nama']?.toString();
        if (nama != null && dl != null) {
          err = 'Lokasi terdekat: $nama — $dl di luar radius (butuh ≤ ${rl ?? "?"} )';
        }
      }
      if (j?['retry'] == true) err = '$err — silakan coba lagi';
      throw Exception(err);
    }
    return j['message']?.toString() ?? 'Berhasil';
  }
}
