import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import {
  assertCallerWithNik,
  assertCallerIsHrdOrAdminMobile,
  assertCallerAuthenticated,
  workDateJakarta,
  matchGeofence,
  nearestLocation,
  formatDistanceM,
  gpsPreviewPayload,
  resolveAllowedLocations,
  clearHadirFromAttendance,
  trySyncHadirFromAttendance,
  attendanceCanDecide,
  canRetryAttendanceEvent,
  checkInBlocksCheckOut,
  loadCloudPayload,
  companyJamMasuk,
  minutesLateFromIso,
} from '../_lib/mobile-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

function buildDashboardSummary(karyawan, logs, workDate, locationFilter) {
  const byNik = {};
  (logs || []).forEach((row) => {
    if (!byNik[row.nik]) byNik[row.nik] = { cin: null, cout: null };
    if (row.event_type === 'check_in') byNik[row.nik].cin = row;
    if (row.event_type === 'check_out') byNik[row.nik].cout = row;
  });

  const summary = {
    hadir_lengkap: 0,
    belum_checkout: 0,
    pending_review: 0,
    tidak_hadir: 0,
    total_karyawan: 0,
  };
  const rows = [];

  (karyawan || []).forEach((k) => {
    if (!k || !k.nik || k.aktif === false) return;
    const nik = String(k.nik).trim();
    const g = byNik[nik] || { cin: null, cout: null };
    const cin = g.cin;
    const cout = g.cout;

    if (locationFilter) {
      const locHit =
        (cin && cin.location_id === locationFilter) ||
        (cout && cout.location_id === locationFilter);
      if (!locHit && cin) return;
      if (!cin && !cout) return;
    }

    summary.total_karyawan++;
    let bucket = 'tidak_hadir';
    if (
      cin &&
      cout &&
      cin.validation_status === 'ok' &&
      cout.validation_status === 'ok'
    ) {
      bucket = 'hadir_lengkap';
      summary.hadir_lengkap++;
    } else if (
      cin &&
      (cin.validation_status === 'pending_review' ||
        (cout && cout.validation_status === 'pending_review'))
    ) {
      bucket = 'pending_review';
      summary.pending_review++;
    } else if (cin && cin.validation_status === 'ok' && (!cout || cout.validation_status === 'rejected')) {
      bucket = 'belum_checkout';
      summary.belum_checkout++;
    } else if (!cin || cin.validation_status === 'rejected') {
      bucket = 'tidak_hadir';
      summary.tidak_hadir++;
    } else {
      bucket = 'belum_checkout';
      summary.belum_checkout++;
    }

    rows.push({
      nik,
      nama: k.nama || nik,
      bucket,
      check_in: cin,
      check_out: cout,
    });
  });

  return { summary, rows };
}

/** HRD: daftar log / dashboard / rekap terlambat */
export async function onRequestGet({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const hrd = await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);

    const url = new URL(request.url);
    const workDate = url.searchParams.get('work_date') || workDateJakarta();
    const nikFilter = (url.searchParams.get('nik') || '').trim();
    const locationFilter = (url.searchParams.get('location_id') || '').trim() || null;

    if (url.searchParams.get('dashboard') === '1') {
      const payload = await loadCloudPayload(sb, tenant);
      const karyawan = payload.karyawan || [];
      const { data: logs } = await sb
        .from('sigaji_attendance_logs')
        .select(
          'id,nik,work_date,event_type,location_id,validation_status,face_verified,face_score,created_at,flags'
        )
        .eq('tenant_key', tenant)
        .eq('work_date', workDate);
      const dash = buildDashboardSummary(karyawan, logs, workDate, locationFilter);
      return jsonResponse(
        200,
        { ok: true, work_date: workDate, location_id: locationFilter, ...dash },
        request
      );
    }

    if (url.searchParams.get('late_report') === '1') {
      const month = (url.searchParams.get('month') || workDate.substring(0, 7)).trim();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return jsonResponse(400, { ok: false, error: 'month format YYYY-MM' }, request);
      }
      const payload = await loadCloudPayload(sb, tenant);
      const jamMasuk = companyJamMasuk(payload);
      const dateFrom = month + '-01';
      const dateTo = month + '-31';
      const { data: logs } = await sb
        .from('sigaji_attendance_logs')
        .select('nik,work_date,event_type,validation_status,created_at,location_id,flags')
        .eq('tenant_key', tenant)
        .eq('event_type', 'check_in')
        .gte('work_date', dateFrom)
        .lte('work_date', dateTo)
        .eq('validation_status', 'ok');
      const karMap = {};
      (payload.karyawan || []).forEach((k) => {
        if (k && k.nik) karMap[k.nik] = k.nama || k.nik;
      });
      const locIds = [...new Set((logs || []).map((l) => l.location_id).filter(Boolean))];
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
      const items = (logs || [])
        .map((row) => {
          const lateMin = minutesLateFromIso(row.created_at, jamMasuk, row.work_date);
          return {
            nik: row.nik,
            nama: karMap[row.nik] || row.nik,
            work_date: row.work_date,
            check_in_at: row.created_at,
            late_minutes: lateMin,
            location_nama: row.location_id ? locMap[row.location_id] || null : null,
          };
        })
        .filter((x) => x.late_minutes > 0)
        .sort((a, b) => b.late_minutes - a.late_minutes);
      const byNik = {};
      items.forEach((it) => {
        if (!byNik[it.nik]) {
          byNik[it.nik] = {
            nik: it.nik,
            nama: it.nama,
            late_days: 0,
            total_late_minutes: 0,
            max_late_minutes: 0,
          };
        }
        byNik[it.nik].late_days++;
        byNik[it.nik].total_late_minutes += it.late_minutes;
        byNik[it.nik].max_late_minutes = Math.max(byNik[it.nik].max_late_minutes, it.late_minutes);
      });
      return jsonResponse(
        200,
        {
          ok: true,
          month,
          jam_masuk: jamMasuk,
          items,
          rekap: Object.values(byNik).sort((a, b) => b.total_late_minutes - a.total_late_minutes),
        },
        request
      );
    }

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

function validateAttendanceGps(isMock, match, accuracyM, nearest) {
  if (isMock) {
    return {
      reject: true,
      code: 'mock_gps',
      error:
        'GPS tidak valid (terdeteksi mock/fake). Matikan aplikasi fake GPS lalu check-in ulang.',
    };
  }
  if (!match) {
    let err =
      'Lokasi di luar radius penugasan. Dekati lokasi kerja yang ditetapkan HRD lalu coba lagi.';
    if (nearest) {
      err =
        'Lokasi terdekat: ' +
        nearest.location.nama +
        ' — ' +
        formatDistanceM(nearest.distanceM) +
        ' di luar radius (butuh ≤ ' +
        formatDistanceM(nearest.radiusM) +
        ')';
    }
    return {
      reject: true,
      code: 'outside_geofence',
      error: err,
      nearest: nearest
        ? {
            id: nearest.location.id,
            nama: nearest.location.nama,
            distance_m: nearest.distanceM,
            distance_label: formatDistanceM(nearest.distanceM),
            radius_m: nearest.radiusM,
            radius_label: formatDistanceM(nearest.radiusM),
          }
        : null,
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
              : row.event_type === 'check_out'
                ? 'Check-out ditolak — karyawan dapat check-out ulang'
                : 'Check-in ditolak — karyawan dapat check-in ulang',
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

    if (action === 'gps_preview') {
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      const workDate = body.work_date || workDateJakarta();
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return jsonResponse(400, { ok: false, error: 'lat/lon invalid' }, request);
      }
      const { locations } = await resolveAllowedLocations(sb, tenant, ctx.nik, workDate);
      if (!locations.length) {
        return jsonResponse(
          409,
          { ok: false, error: 'Belum ada lokasi kerja / penugasan HRD untuk tanggal ini' },
          request
        );
      }
      return jsonResponse(200, gpsPreviewPayload(lat, lon, locations), request);
    }

    if (action === 'history') {
      const days = Math.min(30, Math.max(7, parseInt(body.days, 10) || 14));
      const end = workDateJakarta();
      const start = new Date(end + 'T12:00:00');
      start.setDate(start.getDate() - (days - 1));
      const dateFrom = start.toISOString().substring(0, 10);
      const { data: logs, error: he } = await sb
        .from('sigaji_attendance_logs')
        .select(
          'work_date,event_type,validation_status,created_at,location_id,face_verified,face_score,flags'
        )
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .gte('work_date', dateFrom)
        .lte('work_date', end)
        .order('work_date', { ascending: false });
      if (he) throw he;
      const locIds = [...new Set((logs || []).map((l) => l.location_id).filter(Boolean))];
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
      const byDate = {};
      (logs || []).forEach((row) => {
        if (!byDate[row.work_date]) byDate[row.work_date] = { work_date: row.work_date };
        const slot = byDate[row.work_date];
        const locNama = row.location_id ? locMap[row.location_id] || null : null;
        const distM = row.flags && row.flags.distance_m != null ? row.flags.distance_m : null;
        if (row.event_type === 'check_in') {
          slot.check_in = {
            at: row.created_at,
            status: row.validation_status,
            location_nama: locNama,
            face_score: row.face_score,
            distance_m: distM,
          };
        } else {
          slot.check_out = {
            at: row.created_at,
            status: row.validation_status,
            location_nama: locNama,
            face_score: row.face_score,
            distance_m: distM,
          };
        }
      });
      const items = Object.keys(byDate)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((d) => byDate[d]);
      return jsonResponse(200, { ok: true, days, date_from: dateFrom, date_to: end, items }, request);
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
    const integrityFlags =
      body.integrity_flags && typeof body.integrity_flags === 'object'
        ? body.integrity_flags
        : null;
    const workDate = body.work_date || workDateJakarta();

    if (!faceVerified && !photoPath) {
      return jsonResponse(
        400,
        { ok: false, error: 'Validasi wajah (face_verified) wajib — gunakan APK SiGaji Absen' },
        request
      );
    }
    if (faceVerified) {
      const { data: enr, error: enrErr } = await sb
        .from('sigaji_face_enrollments')
        .select('id,model_version,verify_threshold')
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
      if (String(enr.model_version || '') !== 'mobilefacenet_v4') {
        return jsonResponse(
          403,
          {
            ok: false,
            error: 'Model wajah usang — daftar ulang wajah di app terbaru',
          },
          request
        );
      }
      const rawVt = Number(enr.verify_threshold);
      const reqScore = Number.isFinite(rawVt)
        ? Math.min(Math.max(rawVt, 0.65), 0.68)
        : 0.65;
      if (!Number.isFinite(faceScore) || faceScore < reqScore) {
        return jsonResponse(
          422,
          {
            ok: false,
            error:
              'Validasi wajah gagal — wajah tidak cocok (min ' +
              Math.round(reqScore * 100) +
              '%)',
            retry: true,
          },
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
    const nearest = nearestLocation(lat, lon, locations);
    const gps = validateAttendanceGps(isMock, match, accuracyM, nearest);
    if (gps.reject) {
      const existing = eventType === 'check_in' ? cin : cout;
      const canLogFail = !existing || canRetryAttendanceEvent(existing);
      if (canLogFail) {
        const failStatus =
          gps.code === 'outside_geofence' ? 'outside_geofence' : 'rejected';
        const failRow = {
          tenant_key: tenant,
          nik: ctx.nik,
          work_date: workDate,
          event_type: eventType,
          location_id: gps.nearest ? gps.nearest.id : null,
          lat,
          lon,
          accuracy_m: accuracyM,
          photo_path: photoPath || '',
          face_verified: faceVerified,
          face_score: faceVerified ? faceScore : null,
          device_id: deviceId,
          is_mock: isMock,
          validation_status: failStatus,
          flags: {
            fail_code: gps.code,
            fail_message: gps.error,
            nearest: gps.nearest || null,
            accuracy_m: accuracyM,
            is_mock: isMock,
            face_verified: faceVerified,
            face_score: faceVerified ? faceScore : null,
            integrity_flags: integrityFlags,
            distance_m: gps.nearest ? gps.nearest.distance_m : null,
          },
        };
        await sb
          .from('sigaji_attendance_logs')
          .upsert(failRow, { onConflict: 'tenant_key,nik,work_date,event_type' });
        await clearHadirFromAttendance(sb, tenant, ctx.nik, workDate);
      }
      return jsonResponse(
        422,
        {
          ok: false,
          code: gps.code,
          error: gps.error,
          retry: true,
          nearest: gps.nearest || null,
          logged: canLogFail,
        },
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
          integrity_flags: integrityFlags,
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
