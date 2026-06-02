import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import { assertCallerWithNik } from '../_lib/mobile-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const ctx = await assertCallerWithNik(sb, jwt, tenant);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'list').trim();

    if (action === 'unread_count') {
      const { count, error } = await sb
        .from('sigaji_mobile_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .is('read_at', null);
      if (error) throw error;
      return jsonResponse(200, { ok: true, unread: count || 0 }, request);
    }

    if (action === 'mark_read') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
      const markAll = body.all === true;
      const now = new Date().toISOString();
      let q = sb
        .from('sigaji_mobile_notifications')
        .update({ read_at: now })
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .is('read_at', null);
      if (!markAll && ids.length) q = q.in('id', ids);
      if (!markAll && !ids.length) {
        return jsonResponse(400, { ok: false, error: 'ids atau all:true wajib' }, request);
      }
      const { error } = await q;
      if (error) throw error;
      return jsonResponse(200, { ok: true }, request);
    }

    const limit = Math.min(100, Math.max(1, parseInt(body.limit, 10) || 50));
    const { data, error } = await sb
      .from('sigaji_mobile_notifications')
      .select('id,category,title,body,ref_id,read_at,created_at')
      .eq('tenant_key', tenant)
      .eq('nik', ctx.nik)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const unread = (data || []).filter((n) => !n.read_at).length;
    return jsonResponse(200, { ok: true, items: data || [], unread }, request);
  } catch (e) {
    const msg = e.message || String(e);
    if (/relation.*does not exist|sigaji_mobile_notifications/i.test(msg)) {
      return jsonResponse(
        503,
        {
          ok: false,
          error:
            'Tabel notifikasi belum ada — jalankan sql/supabase_mobile_notifications.sql',
        },
        request
      );
    }
    if (/Forbidden|Missing Authorization|Invalid auth/i.test(msg)) {
      return jsonResponse(403, { ok: false, error: msg }, request);
    }
    return jsonResponse(500, { ok: false, error: msg }, request);
  }
}
