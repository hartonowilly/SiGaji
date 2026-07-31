import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
} from '../_lib/cf-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

/** Putus tautan Telegram untuk NIK (hapus link + permintaan kode pending). */
export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);

    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = await request.json().catch(() => ({}));
    const nik = String(body.nik || '').trim();
    if (!nik) return jsonResponse(400, { ok: false, error: 'nik required' }, request);

    const { error: e1 } = await sb
      .from('sigaji_telegram_links')
      .delete()
      .eq('tenant_key', tenant)
      .eq('nik', nik);
    if (e1) return jsonResponse(500, { ok: false, error: e1.message }, request);

    const { error: e2 } = await sb
      .from('sigaji_telegram_link_requests')
      .delete()
      .eq('tenant_key', tenant)
      .eq('nik', nik);
    if (e2) return jsonResponse(500, { ok: false, error: e2.message }, request);

    return jsonResponse(200, { ok: true, nik, unlinked: true }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
