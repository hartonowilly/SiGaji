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
