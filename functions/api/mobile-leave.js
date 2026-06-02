import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import {
  assertCallerWithNik,
  assertCallerIsHrdOrAdminMobile,
  parseDateOnly,
  applyLeaveToPayload,
  loadCloudPayload,
  saveCloudPayload,
  computeCutiBalanceForYear,
  countLeaveWorkDays,
  validateCutiKuota,
  sumPendingCutiDaysByYear,
  notifyLeaveDecision,
} from '../_lib/mobile-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestGet({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const { data, error } = await sb
      .from('sigaji_leave_requests')
      .select('*')
      .eq('tenant_key', tenant)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const kMap = {};
    const payload = await loadCloudPayload(sb, tenant);
    (payload.karyawan || []).forEach((k) => {
      if (k && k.nik) kMap[k.nik] = k.nama || k.nik;
    });
    const items = (data || []).map((r) =>
      Object.assign({}, r, { nama_karyawan: kMap[r.nik] || r.nik })
    );
    return jsonResponse(200, { ok: true, items }, request);
  } catch (e) {
    return mobileErr(e, request);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'submit').trim();

    if (action === 'decide') {
      const hrd = await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);
      const id = String(body.id || '').trim();
      const decide = String(body.decide || '').trim();
      const note = String(body.note || '').trim();
      if (!id) return jsonResponse(400, { ok: false, error: 'id wajib' }, request);
      if (decide !== 'approve' && decide !== 'reject') {
        return jsonResponse(400, { ok: false, error: 'decide: approve|reject' }, request);
      }

      const { data: req, error: re } = await sb
        .from('sigaji_leave_requests')
        .select('*')
        .eq('tenant_key', tenant)
        .eq('id', id)
        .maybeSingle();
      if (re) throw re;
      if (!req) return jsonResponse(404, { ok: false, error: 'not found' }, request);
      if (req.status !== 'pending') {
        return jsonResponse(409, { ok: false, error: 'sudah diputuskan' }, request);
      }

      const decidedAt = new Date().toISOString();
      if (decide === 'reject') {
        await sb
          .from('sigaji_leave_requests')
          .update({
            status: 'rejected',
            reject_note: note || null,
            decided_at: decidedAt,
            decided_by: hrd.user.id,
            decided_by_name: hrd.me.nama || hrd.me.username,
          })
          .eq('id', id);
        try {
          await notifyLeaveDecision(sb, tenant, req, 'reject', note);
        } catch (ne) {
          console.warn('notifyLeaveDecision reject', ne.message || ne);
        }
        return jsonResponse(200, { ok: true, status: 'rejected' }, request);
      }

      const { data: assigns } = await sb
        .from('sigaji_location_assignments')
        .select('works_saturday')
        .eq('tenant_key', tenant)
        .eq('nik', req.nik)
        .lte('date_from', req.date_to)
        .gte('date_to', req.date_from);
      const worksSaturday =
        (assigns || []).some((a) => a.works_saturday) || true;

      const payload = await loadCloudPayload(sb, tenant);

      if (req.request_type === 'cuti') {
        const v = await validateCutiKuota(
          sb,
          tenant,
          payload,
          req.nik,
          req.date_from,
          req.date_to,
          worksSaturday,
          req.id
        );
        if (!v.ok) {
          return jsonResponse(409, { ok: false, error: v.error, details: v.details }, request);
        }
      }

      const dates = applyLeaveToPayload(
        payload,
        req.nik,
        req.date_from,
        req.date_to,
        req.absensi_status || req.request_type,
        worksSaturday
      );
      await saveCloudPayload(sb, tenant, payload);

      await sb
        .from('sigaji_leave_requests')
        .update({
          status: 'approved',
          decided_at: decidedAt,
          decided_by: hrd.user.id,
          decided_by_name: hrd.me.nama || hrd.me.username,
          reject_note: note || null,
        })
        .eq('id', id);

      try {
        await notifyLeaveDecision(sb, tenant, req, 'approve', note);
      } catch (ne) {
        console.warn('notifyLeaveDecision approve', ne.message || ne);
      }

      return jsonResponse(
        200,
        {
          ok: true,
          status: 'approved',
          applied_dates: dates,
          absensi_patch: { [req.nik]: payload.absensi[req.nik] },
        },
        request
      );
    }

    if (action === 'my_list') {
      const ctx = await assertCallerWithNik(sb, jwt, tenant);
      const { data, error } = await sb
        .from('sigaji_leave_requests')
        .select('*')
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return jsonResponse(200, { ok: true, items: data || [] }, request);
    }

    if (action === 'cuti_balance' || action === 'validate_cuti') {
      const ctx = await assertCallerWithNik(sb, jwt, tenant);
      const payload = await loadCloudPayload(sb, tenant);
      const dateFrom = parseDateOnly(body.date_from);
      const dateTo = parseDateOnly(body.date_to);
      const yr =
        parseInt(body.year, 10) ||
        (dateFrom ? parseInt(String(dateFrom).substring(0, 4), 10) : new Date().getFullYear());

      const { data: assigns } = await sb
        .from('sigaji_location_assignments')
        .select('works_saturday')
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .lte('date_from', dateTo || dateFrom || '2099-12-31')
        .gte('date_to', dateFrom || '2000-01-01');
      const worksSaturday = (assigns || []).some((a) => a.works_saturday) || true;

      const pendingByYear = await sumPendingCutiDaysByYear(
        sb,
        tenant,
        ctx.nik,
        payload,
        null
      );
      const pending = pendingByYear[yr] || 0;
      const balance = computeCutiBalanceForYear(payload, ctx.nik, yr, pending);

      if (action === 'cuti_balance') {
        return jsonResponse(200, { ok: true, balance }, request);
      }

      if (!dateFrom || !dateTo) {
        return jsonResponse(
          400,
          { ok: false, error: 'date_from dan date_to wajib untuk validasi' },
          request
        );
      }
      if (dateTo < dateFrom) {
        return jsonResponse(400, { ok: false, error: 'date_to harus >= date_from' }, request);
      }

      const requestedTotal = countLeaveWorkDays(payload, dateFrom, dateTo, worksSaturday);
      const v = await validateCutiKuota(
        sb,
        tenant,
        payload,
        ctx.nik,
        dateFrom,
        dateTo,
        worksSaturday,
        null
      );
      return jsonResponse(
        200,
        {
          ok: true,
          allowed: v.ok,
          error: v.error || null,
          requested_work_days: requestedTotal,
          balance,
          details: v.details || [],
        },
        request
      );
    }

    const ctx = await assertCallerWithNik(sb, jwt, tenant);
    const requestType = String(body.request_type || 'cuti').trim();
    const dateFrom = parseDateOnly(body.date_from);
    const dateTo = parseDateOnly(body.date_to);
    const reason = String(body.reason || '').trim();
    const attachmentPath = String(body.attachment_path || '').trim() || null;

    if (!dateFrom || !dateTo) {
      return jsonResponse(400, { ok: false, error: 'date_from / date_to wajib (YYYY-MM-DD)' }, request);
    }
    if (dateTo < dateFrom) {
      return jsonResponse(400, { ok: false, error: 'date_to harus >= date_from' }, request);
    }
    if (!['cuti', 'izin', 'sakit'].includes(requestType)) {
      return jsonResponse(400, { ok: false, error: 'request_type invalid' }, request);
    }
    if (requestType === 'sakit' && !attachmentPath) {
      return jsonResponse(
        400,
        { ok: false, error: 'Sakit wajib upload surat dokter sejak hari pertama' },
        request
      );
    }

    const { data: assignsSubmit } = await sb
      .from('sigaji_location_assignments')
      .select('works_saturday')
      .eq('tenant_key', tenant)
      .eq('nik', ctx.nik)
      .lte('date_from', dateTo)
      .gte('date_to', dateFrom);
    const worksSaturdaySubmit =
      (assignsSubmit || []).some((a) => a.works_saturday) || true;

    if (requestType === 'cuti') {
      const payload = await loadCloudPayload(sb, tenant);
      const v = await validateCutiKuota(
        sb,
        tenant,
        payload,
        ctx.nik,
        dateFrom,
        dateTo,
        worksSaturdaySubmit,
        null
      );
      if (!v.ok) {
        return jsonResponse(422, { ok: false, error: v.error, details: v.details }, request);
      }
    }

    const row = {
      tenant_key: tenant,
      nik: ctx.nik,
      request_type: requestType,
      date_from: dateFrom,
      date_to: dateTo,
      reason: reason || null,
      attachment_path: attachmentPath,
      status: 'pending',
    };

    const { data: ins, error: ie } = await sb
      .from('sigaji_leave_requests')
      .insert(row)
      .select('id,status,request_type,date_from,date_to')
      .single();
    if (ie) throw ie;

    return jsonResponse(200, { ok: true, item: ins }, request);
  } catch (e) {
    return mobileErr(e, request);
  }
}

function mobileErr(e, request) {
  const msg = e.message || String(e);
  if (/relation.*does not exist|sigaji_leave/i.test(msg)) {
    return jsonResponse(
      503,
      { ok: false, error: 'Tabel mobile belum ada — jalankan sql/supabase_sigaji_mobile_attendance.sql' },
      request
    );
  }
  if (/Forbidden|Missing Authorization|Invalid auth/i.test(msg)) {
    return jsonResponse(403, { ok: false, error: msg }, request);
  }
  return jsonResponse(500, { ok: false, error: msg }, request);
}
