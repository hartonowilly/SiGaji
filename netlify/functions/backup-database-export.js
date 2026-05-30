const { createClient } = require('@supabase/supabase-js');
const { requireEnv, getTenantKey } = require('./_shared');

function sbAdmin() {
  return createClient(requireEnv('SIGAJI_SUPABASE_URL'), requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

async function loadUsersForAuth(sb, tenant) {
  const { data: storeRow, error: se } = await sb
    .from('sigaji_store')
    .select('data')
    .eq('tenant_key', tenant)
    .eq('store_key', 'users')
    .maybeSingle();
  if (!se && storeRow && storeRow.data && Array.isArray(storeRow.data)) return storeRow.data;
  const { data: row, error: re } = await sb.from('sigaji_cloud').select('payload').eq('tenant_key', tenant).maybeSingle();
  if (re) throw re;
  return (row && row.payload && row.payload.users) || [];
}

async function assertCallerIsHrdOrAdmin(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');
  const users = await loadUsersForAuth(sb, tenant);
  const me = users.find(
    (x) => x && x.email && String(x.email).toLowerCase() === String(u.user.email || '').toLowerCase()
  );
  const role = me && me.role;
  if (role !== 'Admin' && role !== 'HRD') throw new Error('Forbidden — hanya Admin/HRD');
  return { user: u.user, role };
}

async function fetchAllRows(sb, table, buildQuery) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = sb.from(table).select('*');
    if (buildQuery) q = buildQuery(q);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) {
      if (/does not exist|PGRST205|42P01/i.test(String(error.message || '') + String(error.code || ''))) {
        return { rows: [], missing: true };
      }
      throw error;
    }
    const chunk = data || [];
    all.push.apply(all, chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (from > 50000) break;
  }
  return { rows: all, missing: false };
}

function stripLogoFromStoreRows(rows) {
  return (rows || []).map((r) => {
    if (r.store_key !== 'perusahaan' || !r.data || typeof r.data !== 'object') return r;
    const d = Object.assign({}, r.data);
    if (d.logo) d.logo = '[DIHAPUS_DARI_BACKUP]';
    return Object.assign({}, r, { data: d });
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method not allowed' };
    }

    const tenant = getTenantKey();
    const sb = sbAdmin();
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const qs = event.queryStringParameters || {};
    const excludeLogo = qs.exclude_logo === '1' || qs.exclude_logo === 'true';

    const tables = {};
    const stats = {};

    const defs = [
      ['sigaji_tenant_meta', (q) => q.eq('tenant_key', tenant)],
      ['sigaji_karyawan', (q) => q.eq('tenant_key', tenant)],
      ['sigaji_periode', (q) => q.eq('tenant_key', tenant)],
      ['sigaji_tunj_var_kolom', (q) => q.eq('tenant_key', tenant)],
      ['sigaji_tunj_var_nilai', (q) => q.eq('tenant_key', tenant)],
      ['sigaji_store', (q) => q.eq('tenant_key', tenant)],
    ];

    for (const [name, build] of defs) {
      const { rows, missing } = await fetchAllRows(sb, name, build);
      if (missing) {
        stats[name] = 'missing';
        continue;
      }
      let out = rows;
      if (name === 'sigaji_store' && excludeLogo) out = stripLogoFromStoreRows(out);
      tables[name] = out;
      stats[name] = out.length;
    }

    let legacyCloud = null;
    const { data: cloudRow, error: cloudErr } = await sb
      .from('sigaji_cloud')
      .select('tenant_key,updated_at,payload')
      .eq('tenant_key', tenant)
      .maybeSingle();
    if (!cloudErr && cloudRow) {
      legacyCloud = {
        tenant_key: cloudRow.tenant_key,
        updated_at: cloudRow.updated_at,
        payload: excludeLogo && cloudRow.payload && cloudRow.payload.perusahaan
          ? Object.assign({}, cloudRow.payload, {
              perusahaan: Object.assign({}, cloudRow.payload.perusahaan, { logo: '[DIHAPUS_DARI_BACKUP]' }),
            })
          : cloudRow.payload,
      };
      stats.sigaji_cloud = legacyCloud.payload ? 1 : 0;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const body = {
      _meta: {
        type: 'sigaji_database_export_v1',
        tenant_key: tenant,
        exported_at: new Date().toISOString(),
        exclude_logo: !!excludeLogo,
        row_counts: stats,
        note: 'Backup terstruktur per tabel Supabase. Bukan file pg_dump. Restore manual / bantuan admin.',
      },
      tables,
      sigaji_cloud_legacy: legacyCloud,
    };

    const json = JSON.stringify(body);
    const filename = `Sigaji_DB_Export_${tenant}_${stamp}.json`;

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
      body: json,
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: e.message || String(e) }),
    };
  }
};
