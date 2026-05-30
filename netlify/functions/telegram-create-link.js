const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey, randomCode } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function assertCallerIsHrdOrAdmin(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');

  // Load sigaji_cloud payload and check role by email
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
    const caller = await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = JSON.parse(event.body || '{}');
    const nik = String(body.nik || '').trim();
    if (!nik) return json(400, { ok: false, error: 'nik required' });

    const code = randomCode();
    const ttlMin = Math.max(5, Math.min(60, parseInt(body.ttlMin || 15, 10) || 15));
    const exp = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();

    const row = { tenant_key: tenant, nik, code, expires_at: exp, created_by: caller.user.id };
    const { error } = await sb.from('sigaji_telegram_link_requests').upsert(row, { onConflict: 'tenant_key,nik' });
    if (error) return json(500, { ok: false, error: error.message });

    return json(200, { ok: true, nik, code, expires_at: exp });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};

