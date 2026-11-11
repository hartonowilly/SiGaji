import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
} from '../_lib/cf-shared.js';
import { assertNikInScope } from '../_lib/tenant-data.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

/** Pindahkan tautan Telegram dari NIK lama ke NIK baru (ganti NIK di profil). */
export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);

    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const caller = await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = await request.json().catch(() => ({}));
    const fromNik = String(body.fromNik || '').trim();
    const toNik = String(body.toNik || '').trim();
    if (!fromNik || !toNik) return jsonResponse(400, { ok: false, error: 'fromNik and toNik required' }, request);
    await assertNikInScope(sb, tenant, caller.me, fromNik);
    if (fromNik === toNik) return jsonResponse(200, { ok: true, nik: toNik, moved: false }, request);

    const { data: link, error: le } = await sb
      .from('sigaji_telegram_links')
      .select('chat_id')
      .eq('tenant_key', tenant)
      .eq('nik', fromNik)
      .maybeSingle();
    if (le) return jsonResponse(500, { ok: false, error: le.message }, request);
    if (!link || !link.chat_id) {
      await sb.from('sigaji_telegram_link_requests').delete().eq('tenant_key', tenant).eq('nik', fromNik);
      return jsonResponse(200, { ok: true, nik: toNik, moved: false }, request);
    }

    const { error: dTo } = await sb
      .from('sigaji_telegram_links')
      .delete()
      .eq('tenant_key', tenant)
      .eq('nik', toNik);
    if (dTo) return jsonResponse(500, { ok: false, error: dTo.message }, request);

    const { error: dChat } = await sb
      .from('sigaji_telegram_links')
      .delete()
      .eq('tenant_key', tenant)
      .eq('chat_id', link.chat_id)
      .neq('nik', fromNik);
    if (dChat) return jsonResponse(500, { ok: false, error: dChat.message }, request);

    const { error: up } = await sb
      .from('sigaji_telegram_links')
      .update({ nik: toNik })
      .eq('tenant_key', tenant)
      .eq('nik', fromNik);
    if (up) return jsonResponse(500, { ok: false, error: up.message }, request);

    await sb.from('sigaji_telegram_link_requests').delete().eq('tenant_key', tenant).eq('nik', fromNik);
    await sb.from('sigaji_telegram_link_requests').delete().eq('tenant_key', tenant).eq('nik', toNik);

    return jsonResponse(200, { ok: true, nik: toNik, moved: true }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
