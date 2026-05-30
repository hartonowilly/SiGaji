const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function assertCallerIsAdmin(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');

  const { data: row, error: re } = await sb.from('sigaji_cloud').select('payload').eq('tenant_key', tenant).maybeSingle();
  if (re) throw new Error(re.message);
  const payload = row && row.payload;
  const users = (payload && payload.users) || [];
  const me = users.find((x) => x && x.email && String(x.email).toLowerCase() === String(u.user.email || '').toLowerCase());
  const role = me && me.role;
  if (role !== 'Admin') throw new Error('Forbidden');
  return { caller: u.user };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const tenant = getTenantKey();
    const sb = sbAdmin();

    const auth = event.headers.authorization || event.headers.Authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const who = await assertCallerIsAdmin(sb, jwt, tenant);

    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return json(400, { ok: false, error: 'email invalid' });
    if (email === String(who.caller.email || '').toLowerCase()) {
      return json(400, { ok: false, error: 'Tidak boleh menghapus akun sendiri' });
    }

    const list = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (list.error) return json(500, { ok: false, error: list.error.message || String(list.error) });
    const users = (list.data && list.data.users) || [];
    const target = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (!target) return json(200, { ok: true, deleted: false, reason: 'not_found' });

    const del = await sb.auth.admin.deleteUser(target.id);
    if (del.error) return json(500, { ok: false, error: del.error.message || String(del.error) });
    return json(200, { ok: true, deleted: true, user_id: target.id });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};

