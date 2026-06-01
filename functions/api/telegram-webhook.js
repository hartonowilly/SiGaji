import {
  createSbAdmin,
  getTenantKey,
  requireEnv,
  envStr,
  extractStartCode,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const token = requireEnv(env, 'SIGAJI_TELEGRAM_BOT_TOKEN');
    const secret = envStr(env, 'SIGAJI_TELEGRAM_WEBHOOK_SECRET', '');
    if (secret) {
      const hdr = request.headers.get('x-telegram-bot-api-secret-token');
      if (!hdr || String(hdr) !== String(secret)) {
        return jsonResponse(401, { ok: false, error: 'Invalid secret token' }, request);
      }
    }

    const tenant = getTenantKey(env);
    const body = await request.json().catch(() => ({}));
    const msg = body.message || body.edited_message;
    if (!msg || !msg.text || !msg.chat || !msg.from) {
      return jsonResponse(200, { ok: true, ignored: true }, request);
    }

    const code = extractStartCode(msg.text);
    if (!code) return jsonResponse(200, { ok: true, ignored: true }, request);

    const sb = createSbAdmin(env);
    const nowIso = new Date().toISOString();

    const { data: req, error: reqErr } = await sb
      .from('sigaji_telegram_link_requests')
      .select('tenant_key, nik, code, expires_at')
      .eq('tenant_key', tenant)
      .eq('code', code)
      .maybeSingle();

    if (reqErr) return jsonResponse(500, { ok: false, error: reqErr.message }, request);
    if (!req) return jsonResponse(200, { ok: true, unknown_code: true }, request);
    if (req.expires_at && new Date(req.expires_at).getTime() < Date.now()) {
      await sb.from('sigaji_telegram_link_requests').delete().eq('tenant_key', tenant).eq('nik', req.nik);
      return jsonResponse(200, { ok: true, expired: true }, request);
    }

    const chatId = String(msg.chat.id);
    const tg = msg.from || {};
    const linkRow = {
      tenant_key: tenant,
      nik: req.nik,
      chat_id: chatId,
      tg_username: tg.username || null,
      tg_first_name: tg.first_name || null,
      tg_last_name: tg.last_name || null,
      linked_at: nowIso,
    };

    const { error: upErr } = await sb.from('sigaji_telegram_links').upsert(linkRow, { onConflict: 'tenant_key,nik' });
    if (upErr) return jsonResponse(500, { ok: false, error: upErr.message }, request);

    await sb.from('sigaji_telegram_link_requests').delete().eq('tenant_key', tenant).eq('nik', req.nik);

    try {
      const text = `✅ Akun Telegram Anda sudah terhubung.\nNIK: ${req.nik}\nSilakan tunggu slip gaji dari HRD.`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (e) {
      /* best-effort */
    }

    return jsonResponse(200, { ok: true, linked: true, nik: req.nik }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
