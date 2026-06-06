/**
 * POST /api/license-set — atur kuota (hanya penjual, service_role ke Supabase).
 * Header: Authorization: Bearer <SIGAJI_LICENSE_ADMIN_SECRET>
 * Body: { "maxEmployees": 20, "planLabel": "Basic", "tenant_key": "main" }
 */
import { createClient } from '@supabase/supabase-js';
import {
  requireEnv,
  envStr,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';

function getTenantKey(env, body) {
  const fromBody = body && (body.tenant_key || body.tenantKey);
  if (fromBody && String(fromBody).trim()) return String(fromBody).trim();
  return envStr(env, 'SIGAJI_TENANT_KEY', 'main');
}

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = requireEnv(env, 'SIGAJI_LICENSE_ADMIN_SECRET');
    const auth = request.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== secret) {
      return jsonResponse(401, { ok: false, error: 'Unauthorized' }, request);
    }

    const body = await request.json().catch(() => ({}));
    const maxRaw = body.maxEmployees != null ? body.maxEmployees : body.max_employees;
    let maxEmployees = null;
    if (maxRaw !== null && maxRaw !== undefined && String(maxRaw).trim() !== '') {
      const n = parseInt(maxRaw, 10);
      if (!Number.isFinite(n) || n < 0) {
        return jsonResponse(400, { ok: false, error: 'maxEmployees must be non-negative integer or null' }, request);
      }
      maxEmployees = n > 0 ? n : null;
    }
    const planLabel =
      body.planLabel != null
        ? String(body.planLabel).trim() || null
        : body.plan_label != null
          ? String(body.plan_label).trim() || null
          : null;

    const multiBranchEnabled =
      body.multiBranchEnabled != null
        ? !!body.multiBranchEnabled
        : body.multi_branch_enabled != null
          ? !!body.multi_branch_enabled
          : undefined;
    const maxBranchesRaw =
      body.maxBranches != null ? body.maxBranches : body.max_branches;
    let maxBranches;
    if (maxBranchesRaw != null && String(maxBranchesRaw).trim() !== '') {
      const mb = parseInt(maxBranchesRaw, 10);
      if (!Number.isFinite(mb) || mb < 1 || mb > 99) {
        return jsonResponse(400, { ok: false, error: 'maxBranches must be 1–99' }, request);
      }
      maxBranches = mb;
    }

    const tenant = getTenantKey(env, body);
    const sb = createClient(
      requireEnv(env, 'SIGAJI_SUPABASE_URL'),
      requireEnv(env, 'SIGAJI_SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );

    const { data: existing } = await sb
      .from('sigaji_tenant_meta')
      .select('schema_version')
      .eq('tenant_key', tenant)
      .maybeSingle();

    const row = {
      tenant_key: tenant,
      max_employees: maxEmployees,
      plan_label: planLabel,
      updated_at: new Date().toISOString(),
      schema_version: existing && existing.schema_version != null ? existing.schema_version : 10,
    };
    if (multiBranchEnabled !== undefined) row.multi_branch_enabled = multiBranchEnabled;
    if (maxBranches !== undefined) row.max_branches = maxBranches;

    const { error } = await sb.from('sigaji_tenant_meta').upsert(row, { onConflict: 'tenant_key' });
    if (error) return jsonResponse(500, { ok: false, error: error.message }, request);

    return jsonResponse(
      200,
      {
        ok: true,
        tenant_key: tenant,
        max_employees: maxEmployees,
        plan_label: planLabel,
        hint: 'Pelanggan refresh browser / login ulang agar kuota terbaca.',
      },
      request
    );
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
