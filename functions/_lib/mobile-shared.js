/**
 * Logika bersama API mobile absensi & cuti SiGaji.
 */
import {
  loadUsersForAuth,
  matchSigajiUserForAuth,
} from './cf-shared.js';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function workDateJakarta(isoNow) {
  const t = isoNow ? new Date(isoNow) : new Date();
  const j = new Date(t.getTime() + JAKARTA_OFFSET_MS);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, '0');
  const d = String(j.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

export function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseDateOnly(s) {
  const t = String(s || '').trim().substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

export function addDaysIso(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().substring(0, 10);
}

export function enumerateWorkDates(payload, dateFrom, dateTo, worksSaturday) {
  const hk = (payload && payload.perusahaan && payload.perusahaan.hariKerja) || 6;
  const hariLibur = (payload && payload.hariLibur) || [];
  const hlMap = {};
  hariLibur.forEach((l) => {
    if (l && l.tgl) hlMap[String(l.tgl).substring(0, 10)] = l.tipe || '';
  });
  const out = [];
  let cur = dateFrom;
  while (cur <= dateTo) {
    const dow = new Date(cur + 'T12:00:00').getDay();
    if (dow === 0) {
      cur = addDaysIso(cur, 1);
      continue;
    }
    if (dow === 6) {
      const satOk = worksSaturday === true || hk === 6;
      if (!satOk) {
        cur = addDaysIso(cur, 1);
        continue;
      }
    }
    const tipe = hlMap[cur];
    if (tipe === 'libnas' || tipe === 'cuti-bersama') {
      cur = addDaysIso(cur, 1);
      continue;
    }
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

export function applyLeaveToPayload(payload, nik, dateFrom, dateTo, absensiStatus, worksSaturday) {
  const dates = enumerateWorkDates(payload, dateFrom, dateTo, worksSaturday);
  if (!payload.absensi) payload.absensi = {};
  if (!payload.absensi[nik]) payload.absensi[nik] = {};
  dates.forEach((d) => {
    payload.absensi[nik][d] = absensiStatus;
  });
  return dates;
}

export async function loadCloudPayload(sb, tenant) {
  const { data: row, error } = await sb
    .from('sigaji_cloud')
    .select('payload')
    .eq('tenant_key', tenant)
    .maybeSingle();
  if (error) throw error;
  return (row && row.payload) || {};
}

export async function saveCloudPayload(sb, tenant, payload) {
  const { error } = await sb
    .from('sigaji_cloud')
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('tenant_key', tenant);
  if (error) throw error;
}

export async function assertCallerAuthenticated(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');
  const users = await loadUsersForAuth(sb, tenant);
  const me = matchSigajiUserForAuth(users, u.user);
  if (!me) {
    throw new Error(
      'Akun tidak terhubung ke data SiGaji — samakan email login dengan Manajemen User'
    );
  }
  const payload = await loadCloudPayload(sb, tenant);
  return { user: u.user, role: me.role, me, payload };
}

export async function assertCallerIsHrdOrAdminMobile(sb, jwt, tenant) {
  const ctx = await assertCallerAuthenticated(sb, jwt, tenant);
  if (ctx.role !== 'Admin' && ctx.role !== 'HRD') {
    throw new Error('Forbidden — hanya Admin/HRD');
  }
  return ctx;
}

export async function assertCallerWithNik(sb, jwt, tenant) {
  const ctx = await assertCallerAuthenticated(sb, jwt, tenant);
  const nik = ctx.me && ctx.me.nik ? String(ctx.me.nik).trim() : '';
  if (!nik) throw new Error('User belum punya NIK karyawan — hubungi HRD');
  return Object.assign(ctx, { nik });
}

export async function fetchAssignmentsForDate(sb, tenant, nik, workDate) {
  const { data, error } = await sb
    .from('sigaji_location_assignments')
    .select('id,location_id,works_saturday,date_from,date_to')
    .eq('tenant_key', tenant)
    .eq('nik', nik)
    .lte('date_from', workDate)
    .gte('date_to', workDate);
  if (error) throw error;
  return data || [];
}

export async function fetchLocationById(sb, tenant, id) {
  const { data, error } = await sb
    .from('sigaji_work_locations')
    .select('*')
    .eq('tenant_key', tenant)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchDefaultKantorLocations(sb, tenant) {
  const { data, error } = await sb
    .from('sigaji_work_locations')
    .select('*')
    .eq('tenant_key', tenant)
    .eq('aktif', true)
    .in('tipe', ['kantor', 'site', 'mess', 'dinas', 'lainnya']);
  if (error) throw error;
  return data || [];
}

export async function resolveAllowedLocations(sb, tenant, nik, workDate) {
  const assigns = await fetchAssignmentsForDate(sb, tenant, nik, workDate);
  const locs = [];
  for (const a of assigns) {
    const loc = await fetchLocationById(sb, tenant, a.location_id);
    if (loc && loc.aktif) locs.push(loc);
  }
  if (locs.length) return { locations: locs, worksSaturday: assigns.some((x) => x.works_saturday) };
  const all = await fetchDefaultKantorLocations(sb, tenant);
  const kantor = all.filter((l) => l.tipe === 'kantor');
  return {
    locations: kantor.length ? kantor : all,
    worksSaturday: true,
  };
}

export function matchGeofence(lat, lon, locations) {
  let best = null;
  let bestDist = Infinity;
  for (const loc of locations) {
    const d = haversineM(lat, lon, loc.lat, loc.lon);
    if (d <= loc.radius_m && d < bestDist) {
      best = loc;
      bestDist = d;
    }
  }
  return best ? { location: best, distanceM: Math.round(bestDist) } : null;
}

export function afterCheckinPairValid(checkInRow, checkOutRow) {
  return !!(checkInRow && checkOutRow);
}

export function attendancePairAllowsHadir(cin, cout) {
  if (!cin || !cout) return false;
  if (cin.validation_status === 'rejected' || cout.validation_status === 'rejected') {
    return false;
  }
  return cin.validation_status === 'ok' && cout.validation_status === 'ok';
}

export async function applyHadirFromAttendance(sb, tenant, payload, nik, workDate) {
  const { data: logs } = await sb
    .from('sigaji_attendance_logs')
    .select('event_type,validation_status')
    .eq('tenant_key', tenant)
    .eq('nik', nik)
    .eq('work_date', workDate);
  const cin = (logs || []).find((x) => x.event_type === 'check_in');
  const cout = (logs || []).find((x) => x.event_type === 'check_out');
  if (!attendancePairAllowsHadir(cin, cout)) return false;
  if (!payload.absensi) payload.absensi = {};
  if (!payload.absensi[nik]) payload.absensi[nik] = {};
  payload.absensi[nik][workDate] = 'hadir';
  return true;
}

export async function clearHadirFromAttendance(sb, tenant, nik, workDate) {
  const payload = await loadCloudPayload(sb, tenant);
  if (!payload.absensi || !payload.absensi[nik]) return false;
  if (payload.absensi[nik][workDate] !== 'hadir') return false;
  delete payload.absensi[nik][workDate];
  await saveCloudPayload(sb, tenant, payload);
  return true;
}

export async function trySyncHadirFromAttendance(sb, tenant, nik, workDate) {
  const payload = await loadCloudPayload(sb, tenant);
  const changed = await applyHadirFromAttendance(sb, tenant, payload, nik, workDate);
  if (changed) await saveCloudPayload(sb, tenant, payload);
  return changed;
}

/** Apakah HRD/Admin boleh approve/reject log ini. */
export function attendanceCanDecide(row, decide) {
  if (!row || !decide) return false;
  const st = row.validation_status;
  if (decide === 'approve') {
    return st === 'pending_review' || st === 'outside_geofence';
  }
  if (decide === 'reject') {
    return st === 'pending_review' || st === 'outside_geofence' || st === 'ok';
  }
  return false;
}

/** @deprecated gunakan attendanceCanDecide */
export function attendanceDecideAllowedStatuses() {
  return ['pending_review', 'outside_geofence', 'ok'];
}

export function canRetryAttendanceEvent(row) {
  return !row || row.validation_status === 'rejected';
}

export function checkInBlocksCheckOut(cin) {
  return !!(cin && cin.validation_status && cin.validation_status !== 'rejected');
}

// ── Kuota cuti (selaras rekap Absensi → tab Cuti) ───────────────────────────

export function isHariLiburKerjaDow(dow, hariKerja) {
  const hk = hariKerja || 6;
  if (hk === 5) return dow === 0 || dow === 6;
  return dow === 0;
}

function getCrossYearTailRanges(payload, yr) {
  const y = String(yr);
  const yearStart = y + '-01-01';
  const prevDay = addDaysIso(yearStart, -1);
  const tails = [];
  (payload.periodes || []).forEach((p) => {
    const s = parseDateOnly(p && p.start);
    const e = parseDateOnly(p && p.end);
    if (!s || !e) return;
    if (!(s < yearStart && e >= yearStart)) return;
    const tailStart = s;
    const tailEnd = e < yearStart ? e : prevDay;
    if (tailStart <= tailEnd) tails.push({ start: tailStart, end: tailEnd });
  });
  return tails;
}

function isCutiBersamaPotongKuotaTgl(payload, tglIso) {
  const masterCuti = payload.masterCuti || {};
  if (masterCuti.cbPotong === false) return false;
  const d = parseDateOnly(tglIso);
  if (!d) return false;
  const lib = (payload.hariLibur || []).find(
    (x) => x && parseDateOnly(x.tgl) === d && x.tipe === 'cuti-bersama'
  );
  if (!lib) return false;
  const hk = (payload.perusahaan && payload.perusahaan.hariKerja) || 6;
  return !isHariLiburKerjaDow(new Date(d + 'T12:00:00').getDay(), hk);
}

function cutiManualTrackingYear(payload, nik, yr) {
  const y = String(yr);
  const ys = y + '-01-01';
  const ab = (payload.absensi && payload.absensi[nik]) || {};
  let n = 0;
  Object.keys(ab).forEach((raw) => {
    if (ab[raw] !== 'cuti') return;
    const d = parseDateOnly(raw);
    if (!d || !d.startsWith(y)) return;
    if (isCutiBersamaPotongKuotaTgl(payload, d)) return;
    n++;
  });
  const tails = getCrossYearTailRanges(payload, yr);
  if (!tails.length) return n;
  Object.keys(ab).forEach((raw) => {
    if (ab[raw] !== 'cuti') return;
    const d = parseDateOnly(raw);
    if (!d || d >= ys) return;
    if (isCutiBersamaPotongKuotaTgl(payload, d)) return;
    for (let i = 0; i < tails.length; i++) {
      const r = tails[i];
      if (d >= r.start && d <= r.end) {
        n++;
        break;
      }
    }
  });
  return n;
}

function countCutiBersamaYear(payload, yr) {
  const masterCuti = payload.masterCuti || {};
  if (masterCuti.cbPotong === false) return 0;
  const y = String(yr);
  const hk = (payload.perusahaan && payload.perusahaan.hariKerja) || 6;
  return (payload.hariLibur || []).filter((l) => {
    if (!l || l.tipe !== 'cuti-bersama') return false;
    const t = parseDateOnly(l.tgl);
    if (!t || !t.startsWith(y)) return false;
    return !isHariLiburKerjaDow(new Date(t + 'T12:00:00').getDay(), hk);
  }).length;
}

function countCutiBersamaTrackingYear(payload, yr) {
  let n = countCutiBersamaYear(payload, yr);
  const tails = getCrossYearTailRanges(payload, yr);
  if (!tails.length) return n;
  const masterCuti = payload.masterCuti || {};
  if (masterCuti.cbPotong === false) return n;
  const y = String(yr);
  const hk = (payload.perusahaan && payload.perusahaan.hariKerja) || 6;
  const extra = (payload.hariLibur || []).filter((l) => {
    if (!l || l.tipe !== 'cuti-bersama') return false;
    const d = parseDateOnly(l.tgl);
    if (!d || d >= y + '-01-01') return false;
    if (isHariLiburKerjaDow(new Date(d + 'T12:00:00').getDay(), hk)) return false;
    return tails.some((r) => d >= r.start && d <= r.end);
  }).length;
  return n + extra;
}

/** Hari kerja dalam rentang yang akan diisi status cuti (sama aturan pengajuan). */
export function countLeaveWorkDays(payload, dateFrom, dateTo, worksSaturday) {
  return enumerateWorkDates(payload, dateFrom, dateTo, worksSaturday).length;
}

function countLeaveWorkDaysInYear(payload, dateFrom, dateTo, worksSaturday, yr) {
  const y = String(yr);
  return enumerateWorkDates(payload, dateFrom, dateTo, worksSaturday).filter((d) =>
    d.startsWith(y)
  ).length;
}

function yearsInRange(dateFrom, dateTo) {
  const ys = new Set();
  const y0 = parseInt(String(dateFrom).substring(0, 4), 10);
  const y1 = parseInt(String(dateTo).substring(0, 4), 10);
  for (let y = y0; y <= y1; y++) ys.add(y);
  return [...ys];
}

export function computeCutiBalanceForYear(payload, nik, yr, extraPendingDays) {
  const kuota = (payload.masterCuti && payload.masterCuti.kuota) || 12;
  const manual = cutiManualTrackingYear(payload, nik, yr);
  const cb = countCutiBersamaTrackingYear(payload, yr);
  const pending = extraPendingDays || 0;
  const terpakai = manual + cb + pending;
  const sisa = kuota - terpakai;
  return {
    year: yr,
    kuota,
    cuti_dari_absensi: manual,
    cuti_bersama: cb,
    pending_pengajuan: pending,
    terpakai,
    sisa,
  };
}

/** Jumlah hari kerja cuti pending (pengajuan menunggu) per tahun kalender. */
export async function sumPendingCutiDaysByYear(sb, tenant, nik, payload, excludeRequestId) {
  const { data, error } = await sb
    .from('sigaji_leave_requests')
    .select('id,date_from,date_to,status,request_type')
    .eq('tenant_key', tenant)
    .eq('nik', nik)
    .eq('request_type', 'cuti')
    .eq('status', 'pending');
  if (error) throw error;
  const byYear = {};
  (data || []).forEach((row) => {
    if (excludeRequestId && String(row.id) === String(excludeRequestId)) return;
    const df = parseDateOnly(row.date_from);
    const dt = parseDateOnly(row.date_to);
    if (!df || !dt) return;
    yearsInRange(df, dt).forEach((yr) => {
      const n = countLeaveWorkDaysInYear(payload, df, dt, true, yr);
      byYear[yr] = (byYear[yr] || 0) + n;
    });
  });
  return byYear;
}

/**
 * Validasi pengajuan cuti tidak melebihi sisa kuota (per tahun kalender).
 * @returns {{ ok: boolean, error?: string, details?: object[] }}
 */
export async function validateCutiKuota(
  sb,
  tenant,
  payload,
  nik,
  dateFrom,
  dateTo,
  worksSaturday,
  excludeRequestId
) {
  const pendingByYear = await sumPendingCutiDaysByYear(
    sb,
    tenant,
    nik,
    payload,
    excludeRequestId
  );
  const years = yearsInRange(dateFrom, dateTo);
  const details = [];
  for (const yr of years) {
    const requested = countLeaveWorkDaysInYear(
      payload,
      dateFrom,
      dateTo,
      worksSaturday,
      yr
    );
    if (requested <= 0) continue;
    const pending = pendingByYear[yr] || 0;
    const bal = computeCutiBalanceForYear(payload, nik, yr, pending);
    details.push({
      year: yr,
      requested,
      sisa: bal.sisa,
      kuota: bal.kuota,
      terpakai: bal.terpakai,
    });
    if (requested > bal.sisa) {
      return {
        ok: false,
        error:
          'Cuti melebihi sisa kuota tahun ' +
          yr +
          ': mengajukan ' +
          requested +
          ' hari kerja, sisa ' +
          Math.max(0, bal.sisa) +
          ' hari (kuota ' +
          bal.kuota +
          ', terpakai ' +
          bal.terpakai +
          ' termasuk pengajuan pending)',
        details,
      };
    }
  }
  return { ok: true, details };
}

// ── Notifikasi mobile (PWA karyawan) ────────────────────────────────────────

const LEAVE_TYPE_LABEL = { cuti: 'Cuti tahunan', izin: 'Izin', sakit: 'Sakit' };

export function leaveDecisionNotificationContent(req, decide, rejectNote) {
  const lbl = LEAVE_TYPE_LABEL[req.request_type] || req.request_type || 'Pengajuan';
  const range = req.date_from + ' – ' + req.date_to;
  if (decide === 'approve') {
    return {
      title: lbl + ' disetujui',
      body:
        'Pengajuan ' +
        lbl +
        ' (' +
        range +
        ') telah disetujui HRD. Absensi akan diperbarui.',
    };
  }
  const note = String(rejectNote || '').trim();
  return {
    title: lbl + ' ditolak',
    body:
      'Pengajuan ' +
      lbl +
      ' (' +
      range +
      ') ditolak HRD.' +
      (note ? ' Catatan: ' + note : ''),
  };
}

export async function insertMobileNotification(sb, tenant, nik, row) {
  const { error } = await sb.from('sigaji_mobile_notifications').insert({
    tenant_key: tenant,
    nik,
    category: row.category || 'leave',
    title: row.title,
    body: row.body,
    ref_id: row.ref_id || null,
  });
  if (error) throw error;
}

export async function notifyLeaveDecision(sb, tenant, req, decide, rejectNote) {
  const content = leaveDecisionNotificationContent(req, decide, rejectNote);
  await insertMobileNotification(sb, tenant, req.nik, {
    category: 'leave',
    title: content.title,
    body: content.body,
    ref_id: req.id,
  });
}
