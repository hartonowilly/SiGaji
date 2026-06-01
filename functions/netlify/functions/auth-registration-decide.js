import {
  createSbAdmin,
  getTenantKey,
  getSiteUrl,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
} from '../../_lib/cf-shared.js';

function sanitizeNama(nama, fallbackEmail) {
  const t = String(nama || '').trim();
  if (t) return t.slice(0, 80);
  return String(fallbackEmail || '').split('@')[0].slice(0, 80) || 'User';
}

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);

    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const caller = await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();
    const note = String(body.note || '').trim();
    if (!id) return jsonResponse(400, { ok: false, error: 'id required' }, request);
    if (action !== 'approve' && action !== 'reject') {
      return jsonResponse(400, { ok: false, error: 'action invalid' }, request);
    }

    const { data: req, error: re } = await sb
      .from('sigaji_registration_requests')
      .select('id,email,nama,nik,status')
      .eq('tenant_key', tenant)
      .eq('id', id)
      .maybeSingle();
    if (re) return jsonResponse(500, { ok: false, error: re.message }, request);
    if (!req) return jsonResponse(404, { ok: false, error: 'request not found' }, request);
    if (req.status !== 'pending') {
      return jsonResponse(409, { ok: false, error: 'request already decided' }, request);
    }

    const decidedAt = new Date().toISOString();

    if (action === 'reject') {
      const { error: uerr } = await sb
        .from('sigaji_registration_requests')
        .update({
          status: 'rejected',
          note: note || null,
          decided_at: decidedAt,
          decided_by: caller.user.id,
        })
        .eq('tenant_key', tenant)
        .eq('id', id);
      if (uerr) return jsonResponse(500, { ok: false, error: uerr.message }, request);
      return jsonResponse(200, { ok: true, status: 'rejected' }, request);
    }

    const payload = caller.payload || {};
    const users = Array.isArray(payload.users) ? payload.users : [];
    const emailLower = String(req.email || '').toLowerCase();
    const exists = users.some(
      (u) => u && u.email && String(u.email).toLowerCase() === emailLower
    );
    if (!exists) {
      users.push({
        username: emailLower.split('@')[0],
        password: '',
        nama: sanitizeNama(req.nama, req.email),
        role: 'Karyawan',
        nik: req.nik || null,
        aktif: true,
        email: req.email,
      });
      payload.users = users;
      const { error: perr } = await sb
        .from('sigaji_cloud')
        .update({ payload })
        .eq('tenant_key', tenant);
      if (perr) return jsonResponse(500, { ok: false, error: perr.message }, request);
    }

    let inviteOk = false;
    let inviteMsg = '';
    let inviteAuthUserId = null;
    try {
      const redirectTo = getSiteUrl(request, env) || null;
      const { data: inv, error: invErr } = await sb.auth.admin.inviteUserByEmail(req.email, {
        redirectTo,
      });
      if (invErr) {
        const msg = String(invErr.message || invErr);
        if (/already|exists|registered|been invited|duplicate/i.test(msg)) {
          const rr = await sb.auth.resetPasswordForEmail(req.email, {
            redirectTo: redirectTo || undefined,
          });
          if (rr && rr.error) {
            inviteMsg = `invite failed: ${msg}; reset failed: ${rr.error.message || rr.error}`;
          } else {
            inviteOk = true;
            inviteMsg = 'existing user: reset email sent';
            try {
              const { data: lud } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
              const found =
                (lud &&
                  lud.users &&
                  lud.users.find((x) => String(x.email || '').toLowerCase() === emailLower)) ||
                null;
              if (found && found.id) inviteAuthUserId = found.id;
            } catch (e) {}
          }
        } else {
          inviteMsg = msg;
        }
      } else {
        inviteOk = true;
        inviteMsg = 'invited';
        if (inv && inv.user && inv.user.id) inviteAuthUserId = inv.user.id;
        try {
          if (inv && inv.user && inv.user.id) {
            await sb.auth.admin.updateUserById(inv.user.id, {
              user_metadata: { nama: sanitizeNama(req.nama, req.email), nik: req.nik || null },
            });
          }
        } catch (e) {}
      }
    } catch (e) {
      inviteMsg = e.message || String(e);
    }

    if (inviteAuthUserId) {
      try {
        const usersArr = Array.isArray(payload.users) ? payload.users.slice() : [];
        const idx = usersArr.findIndex(
          (u) => u && u.email && String(u.email).toLowerCase() === emailLower
        );
        if (idx >= 0) {
          usersArr[idx] = Object.assign({}, usersArr[idx], { auth_uid: inviteAuthUserId });
          payload.users = usersArr;
          const { error: puidErr } = await sb
            .from('sigaji_cloud')
            .update({ payload })
            .eq('tenant_key', tenant);
          if (puidErr) inviteMsg = `${inviteMsg}; auth_uid save: ${puidErr.message}`;
        }
      } catch (e) {
        inviteMsg = `${inviteMsg}; auth_uid save error`;
      }
    }

    const { error: uerr } = await sb
      .from('sigaji_registration_requests')
      .update({
        status: 'approved',
        note: note || null,
        decided_at: decidedAt,
        decided_by: caller.user.id,
      })
      .eq('tenant_key', tenant)
      .eq('id', id);
    if (uerr) return jsonResponse(500, { ok: false, error: uerr.message }, request);

    return jsonResponse(
      200,
      { ok: true, status: 'approved', invited: inviteOk, invite_message: inviteMsg },
      request
    );
  } catch (e) {
    return jsonResponse(500, { ok: false, error: e.message || String(e) }, request);
  }
}
