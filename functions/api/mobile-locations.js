import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import {
  assertCallerIsHrdOrAdminMobile,
  parseDateOnly,
} from '../_lib/mobile-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestGet({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);

    const url = new URL(request.url);
    const kind = url.searchParams.get('kind') || 'locations';

    if (kind === 'assignments') {
      const nik = url.searchParams.get('nik') || '';
      let q = sb
        .from('sigaji_location_assignments')
        .select('*, sigaji_work_locations(nama,lat,lon,radius_m,tipe)')
        .eq('tenant_key', tenant)
        .order('date_from', { ascending: false })
        .limit(300);
      if (nik) q = q.eq('nik', nik);
      const { data, error } = await q;
      if (error) throw error;
      return jsonResponse(200, { ok: true, items: data || [] }, request);
    }

    const { data, error } = await sb
      .from('sigaji_work_locations')
      .select('*')
      .eq('tenant_key', tenant)
      .order('nama');
    if (error) throw error;
    return jsonResponse(200, { ok: true, items: data || [] }, request);
  } catch (e) {
    return errResp(e, request);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const ctx = await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();

    if (action === 'save_location') {
      const id = body.id || null;
      const row = {
        tenant_key: tenant,
        code: String(body.code || '').trim() || null,
        nama: String(body.nama || '').trim(),
        lat: Number(body.lat),
        lon: Number(body.lon),
        radius_m: parseInt(body.radius_m, 10) || 200,
        tipe: String(body.tipe || 'site').trim(),
        aktif: body.aktif !== false,
        catatan: String(body.catatan || '').trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (!row.nama || !Number.isFinite(row.lat) || !Number.isFinite(row.lon)) {
        return jsonResponse(400, { ok: false, error: 'nama, lat, lon wajib' }, request);
      }
      if (id) {
        const { data, error } = await sb
          .from('sigaji_work_locations')
          .update(row)
          .eq('tenant_key', tenant)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return jsonResponse(200, { ok: true, item: data }, request);
      }
      const { data, error } = await sb
        .from('sigaji_work_locations')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, item: data }, request);
    }

    if (action === 'delete_location') {
      const id = String(body.id || '').trim();
      if (!id) return jsonResponse(400, { ok: false, error: 'id wajib' }, request);
      const { error } = await sb
        .from('sigaji_work_locations')
        .delete()
        .eq('tenant_key', tenant)
        .eq('id', id);
      if (error) throw error;
      return jsonResponse(200, { ok: true }, request);
    }

    if (action === 'save_assignment') {
      const id = body.id || null;
      const dateFrom = parseDateOnly(body.date_from);
      const dateTo = parseDateOnly(body.date_to);
      const nik = String(body.nik || '').trim();
      const locationId = String(body.location_id || '').trim();
      if (!nik || !locationId || !dateFrom || !dateTo) {
        return jsonResponse(400, { ok: false, error: 'nik, location_id, date_from, date_to wajib' }, request);
      }
      const row = {
        tenant_key: tenant,
        nik,
        location_id: locationId,
        date_from: dateFrom,
        date_to: dateTo,
        works_saturday: body.works_saturday !== false,
        catatan: String(body.catatan || '').trim() || null,
        created_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      };
      if (id) {
        const { data, error } = await sb
          .from('sigaji_location_assignments')
          .update(row)
          .eq('tenant_key', tenant)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return jsonResponse(200, { ok: true, item: data }, request);
      }
      const { data, error } = await sb
        .from('sigaji_location_assignments')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, item: data }, request);
    }

    if (action === 'delete_assignment') {
      const id = String(body.id || '').trim();
      if (!id) return jsonResponse(400, { ok: false, error: 'id wajib' }, request);
      const { error } = await sb
        .from('sigaji_location_assignments')
        .delete()
        .eq('tenant_key', tenant)
        .eq('id', id);
      if (error) throw error;
      return jsonResponse(200, { ok: true }, request);
    }

    return jsonResponse(400, { ok: false, error: 'action tidak dikenal' }, request);
  } catch (e) {
    return errResp(e, request);
  }
}

function errResp(e, request) {
  const msg = e.message || String(e);
  if (/relation.*does not exist|sigaji_work/i.test(msg)) {
    return jsonResponse(
      503,
      { ok: false, error: 'Tabel mobile belum ada — jalankan sql/supabase_sigaji_mobile_attendance.sql' },
      request
    );
  }
  return jsonResponse(500, { ok: false, error: msg }, request);
}
