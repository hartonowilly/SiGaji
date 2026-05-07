const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

function isEmail(s) {
  const t = String(s || '').trim();
  return !!t && t.includes('@') && t.length <= 254;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const tenant = getTenantKey();
    const sb = sbAdmin();

    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || '').trim();
    const nama = String(body.nama || '').trim();
    const nik = String(body.nik || '').trim();
    if (!isEmail(email)) return json(400, { ok: false, error: 'email tidak valid' });

    // prevent duplicate pending request
    const { data: existing, error: ee } = await sb
      .from('sigaji_registration_requests')
      .select('id,status,created_at')
      .eq('tenant_key', tenant)
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);
    if (ee) return json(500, { ok: false, error: ee.message });
    if (existing && existing[0] && existing[0].status === 'pending') {
      return json(200, { ok: true, pending: true, id: existing[0].id });
    }

    const row = { tenant_key: tenant, email, nama: nama || null, nik: nik || null, status: 'pending' };
    const { data, error } = await sb.from('sigaji_registration_requests').insert(row).select('id').single();
    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, id: data.id });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};

