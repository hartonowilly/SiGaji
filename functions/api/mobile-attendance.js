import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import {
  assertCallerWithNik,
  assertCallerIsHrdOrAdminMobile,
  workDateJakarta,
  matchGeofence,
  resolveAllowedLocations,
  clearHadirFromAttendance,
  trySyncHadirFromAttendance,
  attendanceCanDecide,
  canRetryAttendanceEvent,
  checkInBlocksCheckOut,
} from '../_lib/mobile-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

/** HRD: daftar siapa check-in/out di tanggal tertentu */
export async function onRequestGet({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);

    const url = new URL(request.url);
    const workDate = url.searchParams.get('work_date') || workDateJakarta();
    const nikFilter = (url.searchParams.get('nik') || '').trim();

    let q = sb
      .from('sigaji_attendance_logs')
      .select(
        'id,nik,work_date,event_type,location_id,lat,lon,accuracy_m,photo_path,face_verified,face_score,validation_status,is_mock,flags,created_at'
      )
      .eq('tenant_key', tenant)
      .eq('work_date', workDate)
      .order('created_at', { ascending: true });
    if (nikFilter) q = q.eq('nik', nikFilter);

    const { data: logs, error } = await q;
    if (error) throw error;

    const locIds = [
      ...new Set((logs || []).map((l) => l.location_id).filter(Boolean)),
    ];
    const locMap = {};
    if (locIds.length) {
      const { data: locs } = await sb
        .from('sigaji_work_locations')
        .select('id,nama')
        .eq('tenant_key', tenant)
        .in('id', locIds);
      (locs || []).forEach((l) => {
        if (l && l.id) locMap[l.id] = l.nama;
      });
    }

    const items = (logs || []).map((row) => ({
      ...row,
      location_nama: row.location_id ? locMap[row.location_id] || null : null,
    }));

    return jsonResponse(200, { ok: true, work_date: workDate, items }, request);
  } catch (e) {
    const msg = e.message || String(e);
    if (/Forbidden|Invalid auth/i.test(msg)) {
      return jsonResponse(403, { ok: false, error: msg }, request);
    }
    if (/relation.*does not exist|sigaji_attendance/i.test(msg)) {
      return jsonResponse(
        503,
        { ok: false, error: 'Tabel mobile belum ada — jalankan sql mobile' },
        request
      );
    }
    return jsonResponse(500, { ok: false, error: msg }, request);
  }
}

async function fetchDayLogs(sb, tenant, nik, workDate) {
  const { data: logs, error } = await sb
    .from('sigaji_attendance_logs')
    .select('id,event_type,validation_status,created_at')
    .eq('tenant_key', tenant)
    .eq('nik', nik)
    .eq('work_date', workDate);
  if (error) throw error;
  const cin = (logs || []).find((x) => x.event_type === 'check_in') || null;
  const cout = (logs || []).find((x) => x.event_type === 'check_out') || null;
  return { cin, cout };
}

function dayStatusPayload(workDate, cin, cout) {
  const canCheckIn = canRetryAttendanceEvent(cin);
  const cinOk = checkInBlocksCheckOut(cin);
  const canCheckOut = cinOk && (!cout || canRetryAttendanceEvent(cout));
  const complete =
    cinOk &&
    cout &&
    cout.validation_status !== 'rejected' &&
    cin.validation_status === 'ok' &&
    cout.validation_status === 'ok';
  return {
    ok: true,
    work_date: workDate,
    has_check_in: cinOk,
    has_check_out: !!(cout && cout.validation_status !== 'rejected'),
    check_in_status: cin ? cin.validation_status : null,
    check_out_status: cout ? cout.validation_status : null,
    can_check_in: canCheckIn,
    can_check_out: canCheckOut,
    check_out_required: true,
    complete,
    needs_hrd_review:
      (cin && cin.validation_status === 'pending_review') ||
      (cout && cout.validation_status === 'pending_review'),
  };
}

function validateAttendanceGps(isMock, match, accuracyM) {
  if (isMock) {
    return {
      reject: true,
      code: 'mock_gps',
      error:
        'GPS tidak valid (terdeteksi mock/fake). Matikan aplikasi fake GPS lalu check-in ulang.',
    };
  }
  if (!match) {
    return {
      reject: true,
      code: 'outside_geofence',
      error:
        'Lokasi di luar radius penugasan. Dekati lokasi kerja yang ditetapkan HRD lalu coba lagi.',
    };
  }
  let validationStatus = 'ok';
  const flags = {};
  if (accuracyM != null && accuracyM > 80) {
    validationStatus = 'pending_review';
    flags.low_accuracy = true;
  }
  return {
    reject: false,
    validationStatus,
    locationId: match.location.id,
    flags: Object.assign(flags, { distance_m: match.distanceM }),
    locationNama: match.location.nama,
  };
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'check_in').trim();

    if (action === 'decide') {
      const hrd = await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);
      const id = String(body.id || '').trim();
      const decide = String(body.decide || '').trim();
      const note = String(body.note || '').trim();
      if (!id) return jsonResponse(400, { ok: false, error: 'id wajib' }, request);
      if (decide !== 'approve' && decide !== 'reject') {
        return jsonResponse(400, { ok: false, error: 'decide: approve|reject' }, request);
      }

      const { data: row, error: re } = await sb
        .from('sigaji_attendance_logs')
        .select('*')
        .eq('tenant_key', tenant)
        .eq('id', id)
        .maybeSingle();
      if (re) throw re;
      if (!row) return jsonResponse(404, { ok: false, error: 'Log tidak ditemukan' }, request);

      if (!attendanceCanDecide(row, decide)) {
        const hint =
          decide === 'approve'
            ? 'Setujui hanya untuk status Review atau Luar radius. Untuk check-in OK yang salah, gunakan Tolak.'
            : 'Log sudah ditolak atau tidak bisa dibatalkan.';
        return jsonResponse(
          409,
          {
            ok: false,
            error: 'Status ' + row.validation_status + ' — ' + hint,
          },
          request
        );
      }

      const decidedAt = new Date().toISOString();
      const reviewer = hrd.me.nama || hrd.me.username || 'HRD';
      const newStatus = decide === 'approve' ? 'ok' : 'rejected';
      const flags = Object.assign({}, row.flags || {}, {
        review_note: note || null,
        decided_at: decidedAt,
        decided_by: hrd.user.id,
        decided_by_name: reviewer,
      });

      const { error: ue } = await sb
        .from('sigaji_attendance_logs')
        .update({ validation_status: newStatus, flags })
        .eq('id', id);
      if (ue) return jsonResponse(500, { ok: false, error: ue.message }, request);

      if (decide === 'reject' && row.event_type === 'check_in') {
        const { data: cout } = await sb
          .from('sigaji_attendance_logs')
          .select('id,flags')
          .eq('tenant_key', tenant)
          .eq('nik', row.nik)
          .eq('work_date', row.work_date)
          .eq('event_type', 'check_out')
          .maybeSingle();
        if (cout) {
          await sb
            .from('sigaji_attendance_logs')
            .update({
              validation_status: 'rejected',
              flags: Object.assign({}, cout.flags || {}, {
                auto_rejected_with_check_in: true,
                decided_at: decidedAt,
                decided_by_name: reviewer,
              }),
            })
            .eq('id', cout.id);
        }
      }

      await clearHadirFromAttendance(sb, tenant, row.nik, row.work_date);
      let syncedHadir = false;
      if (decide === 'approve') {
        syncedHadir = await trySyncHadirFromAttendance(
          sb,
          tenant,
          row.nik,
          row.work_date
        );
      }

      return jsonResponse(
        200,
        {
          ok: true,
          status: newStatus,
          synced_hadir: syncedHadir,
          message:
            decide === 'approve'
              ? 'Disetujui — absensi diperbarui jika check-in/out lengkap'
              : 'Ditolak — karyawan dapat check-in ulang',
        },
        request
      );
    }

    const ctx = await assertCallerWithNik(sb, jwt, tenant);

    if (action === 'day_status') {
      const workDate = body.work_date || workDateJakarta();
      const { cin, cout } = await fetchDayLogs(sb, tenant, ctx.nik, workDate);
      return jsonResponse(200, dayStatusPayload(workDate, cin, cout), request);
    }

    const eventType = action === 'check_out' ? 'check_out' : 'check_in';
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    const photoPath = String(body.photo_path || '').trim() || null;
    const faceVerified = !!body.face_verified;
    const faceScore = body.face_score != null ? Number(body.face_score) : null;
    const isMock = !!body.is_mock;
    const accuracyM = body.accuracy_m != null ? Number(body.accuracy_m) : null;
    const deviceId = String(body.device_id || '').trim() || null;
    const workDate = body.work_date || workDateJakarta();

    if (!faceVerified && !photoPath) {
      return jsonResponse(
        400,
        { ok: false, error: 'Validasi wajah (face_verified) wajib — gunakan APK SiGaji Absen' },
        request
      );
    }
    if (faceVerified) {
      if (!Number.isFinite(faceScore) || faceScore < 0.65) {
        return jsonResponse(
          422,
          { ok: false, error: 'Validasi wajah gagal — coba lagi di pencahayaan cukup', retry: true },
          request
        );
      }
      const { data: enr, error: enrErr } = await sb
        .from('sigaji_face_enrollments')
        .select('id')
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .maybeSingle();
      if (enrErr) throw enrErr;
      if (!enr) {
        return jsonResponse(
          403,
          { ok: false, error: 'Belum daftar wajah — lakukan enrollment sekali di aplikasi' },
          request
        );
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return jsonResponse(400, { ok: false, error: 'lat/lon invalid' }, request);
    }

    const { cin, cout } = await fetchDayLogs(sb, tenant, ctx.nik, workDate);

    if (eventType === 'check_out') {
      if (!checkInBlocksCheckOut(cin)) {
        return jsonResponse(
          409,
          {
            ok: false,
            code: 'no_check_in',
            error:
              cin && cin.validation_status === 'rejected'
                ? 'Check-in ditolak — lakukan check-in ulang dulu'
                : 'Check-in belum ada — check-out wajib setelah check-in',
          },
          request
        );
      }
      if (cout && !canRetryAttendanceEvent(cout)) {
        return jsonResponse(
          409,
          { ok: false, error: 'Sudah check-out hari ini' },
          request
        );
      }
    } else {
      if (cin && !canRetryAttendanceEvent(cin)) {
        return jsonResponse(
          409,
          {
            ok: false,
            error:
              cin.validation_status === 'pending_review'
                ? 'Check-in menunggu review HRD'
                : 'Sudah check-in hari ini',
          },
          request
        );
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
    const gps = validateAttendanceGps(isMock, match, accuracyM);
    if (gps.reject) {
      return jsonResponse(
        422,
        { ok: false, code: gps.code, error: gps.error, retry: true },
        request
      );
    }

    const row = {
      tenant_key: tenant,
      nik: ctx.nik,
      work_date: workDate,
      event_type: eventType,
      location_id: gps.locationId,
      lat,
      lon,
      accuracy_m: accuracyM,
      photo_path: photoPath || '',
      face_verified: faceVerified,
      face_score: faceVerified ? faceScore : null,
      device_id: deviceId,
      is_mock: isMock,
      validation_status: gps.validationStatus,
      flags: Object.assign(
        {
          accuracy_m: accuracyM,
          is_mock: isMock,
          face_verified: faceVerified,
          face_score: faceVerified ? faceScore : null,
        },
        gps.flags
      ),
    };

    const { data: ins, error: ierr } = await sb
      .from('sigaji_attendance_logs')
      .upsert(row, { onConflict: 'tenant_key,nik,work_date,event_type' })
      .select('id,validation_status')
      .single();
    if (ierr) return jsonResponse(500, { ok: false, error: ierr.message }, request);

    let syncedHadir = false;
    if (gps.validationStatus === 'ok') {
      syncedHadir = await trySyncHadirFromAttendance(sb, tenant, ctx.nik, workDate);
    } else if (gps.validationStatus === 'pending_review') {
      await clearHadirFromAttendance(sb, tenant, ctx.nik, workDate);
    }

    const msg =
      gps.validationStatus === 'ok'
        ? eventType === 'check_in'
          ? 'Check-in tersimpan'
          : 'Check-out tersimpan'
        : 'Tersimpan — menunggu persetujuan HRD';

    const after = await fetchDayLogs(sb, tenant, ctx.nik, workDate);
    return jsonResponse(
      200,
      Object.assign(
        {
          ok: true,
          id: ins && ins.id,
          event_type: eventType,
          validation_status: gps.validationStatus,
          location_nama: gps.locationNama || null,
          synced_hadir: syncedHadir,
          message: msg,
        },
        dayStatusPayload(workDate, after.cin, after.cout)
      ),
      request
    );
  } catch (e) {
    const msg = e.message || String(e);
    if (/Forbidden|Invalid auth/i.test(msg)) {
      return jsonResponse(403, { ok: false, error: msg }, request);
    }
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
