import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import {
  assertCallerWithNik,
  workDateJakarta,
  matchGeofence,
  resolveAllowedLocations,
  loadCloudPayload,
  saveCloudPayload,
  applyHadirFromAttendance,
} from '../_lib/mobile-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const ctx = await assertCallerWithNik(sb, jwt, tenant);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'check_in').trim();

    if (action === 'day_status') {
      const workDate = body.work_date || workDateJakarta();
      const { data: logs } = await sb
        .from('sigaji_attendance_logs')
        .select('event_type,validation_status,created_at')
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .eq('work_date', workDate);
      const cin = (logs || []).find((x) => x.event_type === 'check_in');
      const cout = (logs || []).find((x) => x.event_type === 'check_out');
      return jsonResponse(
        200,
        {
          ok: true,
          work_date: workDate,
          has_check_in: !!cin,
          has_check_out: !!cout,
          check_out_required: true,
          complete: !!(cin && cout),
        },
        request
      );
    }

    const eventType = action === 'check_out' ? 'check_out' : 'check_in';
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    const photoPath = String(body.photo_path || '').trim();
    const isMock = !!body.is_mock;
    const accuracyM = body.accuracy_m != null ? Number(body.accuracy_m) : null;
    const deviceId = String(body.device_id || '').trim() || null;
    const workDate = body.work_date || workDateJakarta();

    if (!photoPath) return jsonResponse(400, { ok: false, error: 'photo_path wajib' }, request);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return jsonResponse(400, { ok: false, error: 'lat/lon invalid' }, request);
    }

    if (eventType === 'check_out') {
      const { data: cin } = await sb
        .from('sigaji_attendance_logs')
        .select('id')
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .eq('work_date', workDate)
        .eq('event_type', 'check_in')
        .maybeSingle();
      if (!cin) {
        return jsonResponse(409, { ok: false, error: 'Check-in belum ada — check-out wajib setelah check-in' }, request);
      }
    }

    const { locations } = await resolveAllowedLocations(sb, tenant, ctx.nik, workDate);
    if (!locations.length) {
      return jsonResponse(
        409,
        { ok: false, error: 'Belum ada lokasi kerja / penugasan HRD untuk tanggal ini' },
        request
      );
    }

    const match = matchGeofence(lat, lon, locations);
    let validationStatus = 'ok';
    let locationId = null;
    const flags = { accuracy_m: accuracyM, is_mock: isMock };
    if (isMock) {
      validationStatus = 'pending_review';
      flags.mock_gps = true;
    }
    if (!match) {
      validationStatus = 'outside_geofence';
      flags.outside_geofence = true;
    } else {
      locationId = match.location.id;
      flags.distance_m = match.distanceM;
    }
    if (accuracyM != null && accuracyM > 80) {
      validationStatus = validationStatus === 'ok' ? 'pending_review' : validationStatus;
      flags.low_accuracy = true;
    }

    const row = {
      tenant_key: tenant,
      nik: ctx.nik,
      work_date: workDate,
      event_type: eventType,
      location_id: locationId,
      lat,
      lon,
      accuracy_m: accuracyM,
      photo_path: photoPath,
      device_id: deviceId,
      is_mock: isMock,
      validation_status: validationStatus,
      flags,
    };

    const { data: ins, error: ierr } = await sb
      .from('sigaji_attendance_logs')
      .upsert(row, { onConflict: 'tenant_key,nik,work_date,event_type' })
      .select('id,validation_status')
      .single();
    if (ierr) return jsonResponse(500, { ok: false, error: ierr.message }, request);

    let syncedHadir = false;
    if (validationStatus === 'ok' || validationStatus === 'pending_review') {
      const payload = await loadCloudPayload(sb, tenant);
      syncedHadir = await applyHadirFromAttendance(sb, tenant, payload, ctx.nik, workDate);
      if (syncedHadir) await saveCloudPayload(sb, tenant, payload);
    }

    return jsonResponse(
      200,
      {
        ok: true,
        id: ins && ins.id,
        event_type: eventType,
        validation_status: validationStatus,
        location_nama: match ? match.location.nama : null,
        synced_hadir: syncedHadir,
        message:
          validationStatus === 'ok'
            ? eventType === 'check_in'
              ? 'Check-in tersimpan'
              : 'Check-out tersimpan'
            : 'Tersimpan — menunggu review HRD',
      },
      request
    );
  } catch (e) {
    const msg = e.message || String(e);
    if (/relation.*does not exist|sigaji_attendance/i.test(msg)) {
      return jsonResponse(
        503,
        { ok: false, error: 'Tabel mobile belum ada — jalankan sql/supabase_sigaji_mobile_attendance.sql' },
        request
      );
    }
    return jsonResponse(500, { ok: false, error: msg }, request);
  }
}
