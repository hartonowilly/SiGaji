/**
 * Atur kuota lisensi dari LUAR aplikasi (hanya Anda sebagai penjual).
 * POST + header: Authorization: Bearer <SIGAJI_LICENSE_ADMIN_SECRET>
 * Body JSON: { "maxEmployees": 20, "planLabel": "Basic" }
 * Opsional env: SIGAJI_TENANT_KEY (default main)
 */
const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }
  try {
    const secret = requireEnv('SIGAJI_LICENSE_ADMIN_SECRET');
    const auth = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '');
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== secret) {
      return json(401, { ok: false, error: 'Unauthorized' });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return json(400, { ok: false, error: 'Invalid JSON body' });
    }

    const maxRaw = body.maxEmployees != null ? body.maxEmployees : body.max_employees;
    let maxEmployees = null;
    if (maxRaw !== null && maxRaw !== undefined && String(maxRaw).trim() !== '') {
      const n = parseInt(maxRaw, 10);
      if (!Number.isFinite(n) || n < 0) {
        return json(400, { ok: false, error: 'maxEmployees must be a non-negative integer or null' });
      }
      maxEmployees = n > 0 ? n : null;
    }

    const planLabel =
      body.planLabel != null
        ? String(body.planLabel).trim() || null
        : body.plan_label != null
          ? String(body.plan_label).trim() || null
          : null;

    const tenant = (body.tenant_key || body.tenantKey || getTenantKey()).trim() || 'main';
    const sb = createClient(requireEnv('SIGAJI_SUPABASE_URL'), requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY'));

    const row = {
      tenant_key: tenant,
      max_employees: maxEmployees,
      plan_label: planLabel,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await sb
      .from('sigaji_tenant_meta')
      .select('schema_version')
      .eq('tenant_key', tenant)
      .maybeSingle();

    if (existing && existing.schema_version != null) {
      row.schema_version = existing.schema_version;
    } else {
      row.schema_version = 10;
    }

    const { error } = await sb.from('sigaji_tenant_meta').upsert(row, { onConflict: 'tenant_key' });
    if (error) return json(500, { ok: false, error: error.message });

    return json(200, {
      ok: true,
      tenant_key: tenant,
      max_employees: maxEmployees,
      plan_label: planLabel,
      hint: 'Pelanggan refresh browser / login ulang agar kuota terbaca.',
    });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};
