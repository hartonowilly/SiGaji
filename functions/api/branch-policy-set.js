/**
 * POST /api/branch-policy-set — aktifkan multi-cabang (hanya creator SiGaji).
 * Header: Authorization: Bearer <Supabase access token user creator>
 * Body: { "multiBranchEnabled": true, "maxBranches": 5, "tenant_key": "main" }
 *
 * Env Cloudflare: SIGAJI_CREATOR_EMAILS=email1@...,email2@...
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

function creatorEmails(env) {
  return envStr(env, 'SIGAJI_CREATOR_EMAILS', '')
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResponse(401, { ok: false, error: 'Token login diperlukan' }, request);
    }

    const url = requireEnv(env, 'SIGAJI_SUPABASE_URL');
    const anon = requireEnv(env, 'SIGAJI_SUPABASE_ANON_KEY');
    const service = requireEnv(env, 'SIGAJI_SUPABASE_SERVICE_ROLE_KEY');

    const userClient = createClient(url, anon, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData || !userData.user || !userData.user.email) {
      return jsonResponse(401, { ok: false, error: 'Sesi tidak valid' }, request);
    }

    const email = String(userData.user.email).trim().toLowerCase();
    const allowed = creatorEmails(env);
    if (!allowed.length) {
      return jsonResponse(
        503,
        { ok: false, error: 'SIGAJI_CREATOR_EMAILS belum diset di server' },
        request
      );
    }
    if (!allowed.includes(email)) {
      return jsonResponse(403, { ok: false, error: 'Hanya creator SiGaji' }, request);
    }

    const body = await request.json().catch(() => ({}));
    const enabled = !!(
      body.multiBranchEnabled ||
      body.multi_branch_enabled
    );
    const maxRaw = body.maxBranches != null ? body.maxBranches : body.max_branches;
    let maxBranches = 1;
    if (maxRaw != null && String(maxRaw).trim() !== '') {
      const n = parseInt(maxRaw, 10);
      if (!Number.isFinite(n) || n < 1 || n > 99) {
        return jsonResponse(400, { ok: false, error: 'maxBranches harus 1–99' }, request);
      }
      maxBranches = n;
    }

    const tenant = getTenantKey(env, body);
    const sb = createClient(url, service, { auth: { persistSession: false } });

    const { data: existing } = await sb
      .from('sigaji_tenant_meta')
      .select('schema_version')
      .eq('tenant_key', tenant)
      .maybeSingle();

    const row = {
      tenant_key: tenant,
      multi_branch_enabled: enabled,
      max_branches: maxBranches,
      updated_at: new Date().toISOString(),
      schema_version: existing && existing.schema_version != null ? existing.schema_version : 10,
    };

    const { error } = await sb.from('sigaji_tenant_meta').upsert(row, { onConflict: 'tenant_key' });
    if (error) return jsonResponse(500, { ok: false, error: error.message }, request);

    return jsonResponse(
      200,
      {
        ok: true,
        tenant_key: tenant,
        multi_branch_enabled: enabled,
        max_branches: maxBranches,
        hint: 'Admin refresh browser agar filter cabang muncul.',
      },
      request
    );
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
