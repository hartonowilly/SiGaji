import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import {
  assertCallerIsHrdOrAdminMobile,
  assertCallerAuthenticated,
  loadCloudPayload,
  saveCloudPayload,
  enumerateWorkDates,
  parseDateOnly,
  syncAlphaFromMobileAttendance,
  workDateJakarta,
} from '../_lib/mobile-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

async function fetchLibnasFromApi(year) {
  const yr = parseInt(year, 10) || new Date().getFullYear();
  const urls = [
    'https://dayoffapi.vercel.app/api?year=' + yr,
    'https://api-harilibur.vercel.app/api?year=' + yr,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (!r.ok) continue;
      const data = await r.json();
      const rows = Array.isArray(data) ? data : data.holidays || data.data || [];
      const out = [];
      rows.forEach((item) => {
        const tgl = String(item.tanggal || item.date || item.holiday_date || '').substring(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return;
        out.push({
          tgl,
          nama: String(item.keterangan || item.summary || item.name || 'Libur nasional').trim(),
          tipe: 'libnas',
        });
      });
      if (out.length) return out;
    } catch (_) {
      /* coba URL berikutnya */
    }
  }
  return [];
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();

    if (action === 'work_dates') {
      const ctx = await assertCallerAuthenticated(sb, jwt, tenant);
      const dateFrom = parseDateOnly(body.date_from);
      const dateTo = parseDateOnly(body.date_to);
      if (!dateFrom || !dateTo || dateTo < dateFrom) {
        return jsonResponse(400, { ok: false, error: 'date_from / date_to invalid' }, request);
      }
      const worksSaturday = body.works_saturday !== false;
      const dates = enumerateWorkDates(ctx.payload, dateFrom, dateTo, worksSaturday);
      return jsonResponse(200, { ok: true, dates, count: dates.length }, request);
    }

    await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);

    if (action === 'import_libnas') {
      const year = parseInt(body.year, 10) || new Date().getFullYear();
      const fetched = await fetchLibnasFromApi(year);
      if (!fetched.length) {
        return jsonResponse(
          502,
          { ok: false, error: 'Gagal mengambil libur nasional — coba lagi nanti' },
          request
        );
      }
      const payload = await loadCloudPayload(sb, tenant);
      const existing = payload.hariLibur || [];
      const map = {};
      existing.forEach((h) => {
        if (h && h.tgl) map[String(h.tgl).substring(0, 10)] = h;
      });
      let added = 0;
      let updated = 0;
      fetched.forEach((h) => {
        const prev = map[h.tgl];
        if (!prev) {
          map[h.tgl] = h;
          added++;
        } else if (prev.tipe !== 'libnas' || prev.nama !== h.nama) {
          map[h.tgl] = Object.assign({}, prev, h);
          updated++;
        }
      });
      payload.hariLibur = Object.keys(map)
        .sort()
        .map((t) => map[t]);
      await saveCloudPayload(sb, tenant, payload);
      return jsonResponse(
        200,
        {
          ok: true,
          year,
          added,
          updated,
          total: payload.hariLibur.length,
          message: 'Libur nasional ' + year + ' diimpor (' + added + ' baru)',
        },
        request
      );
    }

    if (action === 'sync_alpha') {
      const dateFrom = parseDateOnly(body.date_from);
      const dateTo = parseDateOnly(body.date_to) || workDateJakarta();
      if (!dateFrom) {
        return jsonResponse(400, { ok: false, error: 'date_from wajib' }, request);
      }
      const payload = await loadCloudPayload(sb, tenant);
      const result = await syncAlphaFromMobileAttendance(sb, tenant, payload, dateFrom, dateTo);
      return jsonResponse(
        200,
        {
          ok: true,
          marked: result.marked,
          dates: result.dates,
          message:
            result.marked > 0
              ? result.marked + ' hari ditandai alpha (tanpa check-in valid)'
              : 'Tidak ada alpha baru',
        },
        request
      );
    }

    return jsonResponse(400, { ok: false, error: 'action tidak dikenal' }, request);
  } catch (e) {
    const msg = e.message || String(e);
    if (/Forbidden|Invalid auth/i.test(msg)) {
      return jsonResponse(403, { ok: false, error: msg }, request);
    }
    return jsonResponse(500, { ok: false, error: msg }, request);
  }
}
