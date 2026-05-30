const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function assertCallerIsHrdOrAdmin(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');
  const { data: row, error: re } = await sb.from('sigaji_cloud').select('payload').eq('tenant_key', tenant).maybeSingle();
  if (re) throw new Error(re.message);
  const payload = row && row.payload;
  const users = (payload && payload.users) || [];
  const me = users.find((x) => x && x.email && String(x.email).toLowerCase() === String(u.user.email || '').toLowerCase());
  const role = me && me.role;
  if (role !== 'Admin' && role !== 'HRD') throw new Error('Forbidden');
  return { user: u.user, role };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const tenant = getTenantKey();
    const sb = sbAdmin();

    const auth = event.headers.authorization || event.headers.Authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const token = requireEnv('SIGAJI_TELEGRAM_BOT_TOKEN');
    const body = JSON.parse(event.body || '{}');
    const nik = String(body.nik || '').trim();
    const filename = String(body.filename || `Slip_${nik}.pdf`).trim() || `Slip_${nik}.pdf`;
    const caption = String(body.caption || '').trim();
    const pdfBase64 = String(body.pdfBase64 || '');
    if (!nik) return json(400, { ok: false, error: 'nik required' });
    if (!pdfBase64) return json(400, { ok: false, error: 'pdfBase64 required' });

    const { data: link, error: le } = await sb
      .from('sigaji_telegram_links')
      .select('chat_id')
      .eq('tenant_key', tenant)
      .eq('nik', nik)
      .maybeSingle();
    if (le) return json(500, { ok: false, error: le.message });
    if (!link || !link.chat_id) return json(404, { ok: false, error: 'telegram not linked for this nik' });

    const buf = Buffer.from(pdfBase64, 'base64');
    const form = new FormData();
    form.append('chat_id', String(link.chat_id));
    if (caption) form.append('caption', caption);
    form.append('document', new Blob([buf], { type: 'application/pdf' }), filename);

    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return json(500, { ok: false, error: (j && j.description) || 'telegram send failed' });

    return json(200, { ok: true, telegram: true });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};

