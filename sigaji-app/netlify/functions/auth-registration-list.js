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
    if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });
    const tenant = getTenantKey();
    const sb = sbAdmin();

    const auth = event.headers.authorization || event.headers.Authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const status = (event.queryStringParameters && event.queryStringParameters.status) || 'pending';
    const { data, error } = await sb
      .from('sigaji_registration_requests')
      .select('id,email,nama,nik,status,created_at,decided_at,note')
      .eq('tenant_key', tenant)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, items: data || [] });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};

