const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey, extractStartCode } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const token = requireEnv('SIGAJI_TELEGRAM_BOT_TOKEN');
    // optional basic validation: Telegram secret token header
    const secret = process.env.SIGAJI_TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const hdr =
        event.headers['x-telegram-bot-api-secret-token'] || event.headers['X-Telegram-Bot-Api-Secret-Token'];
      if (!hdr || String(hdr) !== String(secret)) return json(401, { ok: false, error: 'Invalid secret token' });
    }

    const tenant = getTenantKey();
    const body = JSON.parse(event.body || '{}');
    const msg = body.message || body.edited_message;
    if (!msg || !msg.text || !msg.chat || !msg.from) return json(200, { ok: true, ignored: true });

    const code = extractStartCode(msg.text);
    if (!code) return json(200, { ok: true, ignored: true });

    const sb = sbAdmin();
    const nowIso = new Date().toISOString();

    const { data: req, error: reqErr } = await sb
      .from('sigaji_telegram_link_requests')
      .select('tenant_key, nik, code, expires_at')
      .eq('tenant_key', tenant)
      .eq('code', code)
      .maybeSingle();

    if (reqErr) return json(500, { ok: false, error: reqErr.message });
    if (!req) return json(200, { ok: true, unknown_code: true });
    if (req.expires_at && new Date(req.expires_at).getTime() < Date.now()) {
      // expire request
      await sb.from('sigaji_telegram_link_requests').delete().eq('tenant_key', tenant).eq('nik', req.nik);
      return json(200, { ok: true, expired: true });
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
    if (upErr) return json(500, { ok: false, error: upErr.message });

    await sb.from('sigaji_telegram_link_requests').delete().eq('tenant_key', tenant).eq('nik', req.nik);

    // Respond to Telegram via sendMessage (best-effort, do not fail webhook)
    try {
      const text = `✅ Akun Telegram Anda sudah terhubung.\nNIK: ${req.nik}\nSilakan tunggu slip gaji dari HRD.`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (e) {}

    return json(200, { ok: true, linked: true, nik: req.nik });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};

