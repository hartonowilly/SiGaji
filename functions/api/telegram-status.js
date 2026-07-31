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

/** Status tautan Telegram untuk NIK. */
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

    const { data: link, error } = await sb
      .from('sigaji_telegram_links')
      .select('nik,chat_id,tg_username,tg_first_name,tg_last_name,linked_at')
      .eq('tenant_key', tenant)
      .eq('nik', nik)
      .maybeSingle();
    if (error) return jsonResponse(500, { ok: false, error: error.message }, request);

    return jsonResponse(200, {
      ok: true,
      nik,
      linked: !!(link && link.chat_id),
      link: link || null,
    }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
