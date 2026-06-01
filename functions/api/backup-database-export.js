import {
  createSbAdmin,
  getTenantKey,
  assertCallerIsHrdOrAdmin,
  corsHeaders,
  handleOptions,
} from '../_lib/cf-shared.js';

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
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (from > 50000) break;
  }
  return { rows: all, missing: false };
}

function stripLogoFromStoreRows(rows) {
  return (rows || []).map((r) => {
    if (r.store_key !== 'perusahaan' || !r.data || typeof r.data !== 'object') return r;
    const d = { ...r.data };
    if (d.logo) d.logo = '[DIHAPUS_DARI_BACKUP]';
    return { ...r, data: d };
  });
}

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestGet({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);

    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const url = new URL(request.url);
    const excludeLogo = url.searchParams.get('exclude_logo') === '1' || url.searchParams.get('exclude_logo') === 'true';

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
        payload:
          excludeLogo && cloudRow.payload && cloudRow.payload.perusahaan
            ? {
                ...cloudRow.payload,
                perusahaan: { ...cloudRow.payload.perusahaan, logo: '[DIHAPUS_DARI_BACKUP]' },
              }
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

    return new Response(json, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
        ...corsHeaders(request),
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || String(e) }), {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        ...corsHeaders(request),
      },
    });
  }
}
