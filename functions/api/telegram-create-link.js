import {
  createSbAdmin,
  getTenantKey,
  randomCode,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
} from '../_lib/cf-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);

    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const caller = await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = await request.json().catch(() => ({}));
    const nik = String(body.nik || '').trim();
    if (!nik) return jsonResponse(400, { ok: false, error: 'nik required' }, request);

    const code = randomCode();
    const ttlMin = Math.max(5, Math.min(60, parseInt(body.ttlMin || 15, 10) || 15));
    const exp = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();

    const row = { tenant_key: tenant, nik, code, expires_at: exp, created_by: caller.user.id };
    const { error } = await sb.from('sigaji_telegram_link_requests').upsert(row, { onConflict: 'tenant_key,nik' });
    if (error) return jsonResponse(500, { ok: false, error: error.message }, request);

    return jsonResponse(200, { ok: true, nik, code, expires_at: exp }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
