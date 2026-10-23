import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
} from '../_lib/cf-shared.js';
import { assertHq } from '../_lib/tenant-data.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestGet({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);

    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const caller = await assertCallerIsHrdOrAdmin(sb, jwt, tenant);
    try {
      assertHq(caller.me);
    } catch (eHq) {
      return jsonResponse(403, { ok: false, error: eHq.message }, request);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';

    const { data, error } = await sb
      .from('sigaji_registration_requests')
      .select('id,email,nama,nik,status,created_at,decided_at,note')
      .eq('tenant_key', tenant)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return jsonResponse(500, { ok: false, error: error.message }, request);
    return jsonResponse(200, { ok: true, items: data || [] }, request);
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
