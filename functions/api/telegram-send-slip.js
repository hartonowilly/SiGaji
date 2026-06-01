import {
  createSbAdmin,
  getTenantKey,
  requireEnv,
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
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const token = requireEnv(env, 'SIGAJI_TELEGRAM_BOT_TOKEN');
    const body = await request.json().catch(() => ({}));
    const nik = String(body.nik || '').trim();
    const filename = String(body.filename || `Slip_${nik}.pdf`).trim() || `Slip_${nik}.pdf`;
    const caption = String(body.caption || '').trim();
    const pdfBase64 = String(body.pdfBase64 || '');
    if (!nik) return jsonResponse(400, { ok: false, error: 'nik required' }, request);
    if (!pdfBase64) return jsonResponse(400, { ok: false, error: 'pdfBase64 required' }, request);

    const { data: link, error: le } = await sb
      .from('sigaji_telegram_links')
      .select('chat_id')
      .eq('tenant_key', tenant)
      .eq('nik', nik)
      .maybeSingle();
    if (le) return jsonResponse(500, { ok: false, error: le.message }, request);
    if (!link || !link.chat_id) {
      return jsonResponse(404, { ok: false, error: 'Telegram belum di-link untuk NIK ini (buat kode link dulu)' }, request);
    }

    const buf = Buffer.from(pdfBase64, 'base64');
    const form = new FormData();
    form.append('chat_id', String(link.chat_id));
    if (caption) form.append('caption', caption);
    form.append('document', new Blob([buf], { type: 'application/pdf' }), filename);

    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      return jsonResponse(500, { ok: false, error: (j && j.description) || 'telegram send failed' }, request);
    }

    return jsonResponse(200, { ok: true, telegram: true }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
