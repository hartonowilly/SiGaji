import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';

function isEmail(s) {
  const t = String(s || '').trim();
  return !!t && t.includes('@') && t.length <= 254;
}

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim();
    const nama = String(body.nama || '').trim();
    const nik = String(body.nik || '').trim();
    if (!isEmail(email)) {
      return jsonResponse(400, { ok: false, error: 'email tidak valid' }, request);
    }

    const { data: existing, error: ee } = await sb
      .from('sigaji_registration_requests')
      .select('id,status,created_at')
      .eq('tenant_key', tenant)
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);
    if (ee) return jsonResponse(500, { ok: false, error: ee.message }, request);
    if (existing && existing[0] && existing[0].status === 'pending') {
      return jsonResponse(200, { ok: true, pending: true, id: existing[0].id }, request);
    }

    const row = {
      tenant_key: tenant,
      email,
      nama: nama || null,
      nik: nik || null,
      status: 'pending',
    };
    const { data, error } = await sb
      .from('sigaji_registration_requests')
      .insert(row)
      .select('id')
      .single();
    if (error) return jsonResponse(500, { ok: false, error: error.message }, request);
    return jsonResponse(200, { ok: true, id: data.id }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
