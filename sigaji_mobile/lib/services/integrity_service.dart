import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Deteksi mock GPS / integritas perangkat (Android native + isMocked Geolocator).
class IntegrityService {
  static const _channel = MethodChannel('com.sigaji.sigaji_mobile/integrity');

  Future<Map<String, dynamic>> check() async {
    final out = <String, dynamic>{
      'mock_location_enabled': false,
      'developer_mode': false,
      'play_integrity_ok': true,
    };
    if (!kIsWeb && Platform.isAndroid) {
      try {
        final native = await _channel.invokeMethod<Map>('checkGpsIntegrity');
        if (native != null) {
          out['mock_location_enabled'] = native['mock_location_enabled'] == true;
          out['developer_mode'] = native['developer_mode'] == true;
        }
      } catch (_) {}
    }
    return out;
  }

  bool shouldRejectGps({
    required bool positionMocked,
    required Map<String, dynamic> integrity,
  }) {
    if (positionMocked) return true;
    if (integrity['mock_location_enabled'] == true) return true;
    return false;
  }
}
