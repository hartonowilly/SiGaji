const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function assertCallerIsHrdOrAdmin(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');
  const { data: row, error: re } = await sb.from('sigaji_cloud').select('payload').eq('tenant_key', tenant).maybeSingle();
  if (re) throw new Error(re.message);
  const payload = row && row.payload;
  const users = (payload && payload.users) || [];
  const me = users.find((x) => x && x.email && String(x.email).toLowerCase() === String(u.user.email || '').toLowerCase());
  const role = me && me.role;
  if (role !== 'Admin' && role !== 'HRD') throw new Error('Forbidden');
  return { user: u.user, role, payload: payload || {}, row };
}

function sanitizeNama(nama, fallbackEmail) {
  const t = String(nama || '').trim();
  if (t) return t.slice(0, 80);
  return String(fallbackEmail || '').split('@')[0].slice(0, 80) || 'User';
}

function getSiteUrl(event) {
  const proto = String(event.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const host = String(event.headers.host || '').trim();
  if (!host) return '';
  return `${proto}://${host}/`;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const tenant = getTenantKey();
    const sb = sbAdmin();

    const auth = event.headers.authorization || event.headers.Authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const caller = await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = JSON.parse(event.body || '{}');
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim(); // approve | reject
    const note = String(body.note || '').trim();
    if (!id) return json(400, { ok: false, error: 'id required' });
    if (action !== 'approve' && action !== 'reject') return json(400, { ok: false, error: 'action invalid' });

    const { data: req, error: re } = await sb
      .from('sigaji_registration_requests')
      .select('id,email,nama,nik,status')
      .eq('tenant_key', tenant)
      .eq('id', id)
      .maybeSingle();
    if (re) return json(500, { ok: false, error: re.message });
    if (!req) return json(404, { ok: false, error: 'request not found' });
    if (req.status !== 'pending') return json(409, { ok: false, error: 'request already decided' });

    const decidedAt = new Date().toISOString();

    if (action === 'reject') {
      const { error: uerr } = await sb
        .from('sigaji_registration_requests')
        .update({ status: 'rejected', note: note || null, decided_at: decidedAt, decided_by: caller.user.id })
        .eq('tenant_key', tenant)
        .eq('id', id);
      if (uerr) return json(500, { ok: false, error: uerr.message });
      return json(200, { ok: true, status: 'rejected' });
    }

    // APPROVE:
    // 1) Ensure email is in SiGaji payload.users with role Karyawan (default)
    const payload = caller.payload || {};
    const users = Array.isArray(payload.users) ? payload.users : [];
    const emailLower = String(req.email || '').toLowerCase();
    const exists = users.some((u) => u && u.email && String(u.email).toLowerCase() === emailLower);
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
      const { error: perr } = await sb.from('sigaji_cloud').update({ payload }).eq('tenant_key', tenant);
      if (perr) return json(500, { ok: false, error: perr.message });
    }

    // 2) Create/invite user in Supabase Auth (send set-password email)
    // If user already exists in Auth, fallback to resetPasswordForEmail so email can be resent.
    let inviteOk = false;
    let inviteMsg = '';
    try {
      const redirectTo = getSiteUrl(event) || null;
      const { data: inv, error: invErr } = await sb.auth.admin.inviteUserByEmail(req.email, { redirectTo });
      if (invErr) {
        const msg = String(invErr.message || invErr);
        // Existing user / already invited: send reset email as fallback
        if (/already|exists|registered|been invited|duplicate/i.test(msg)) {
          const rr = await sb.auth.resetPasswordForEmail(req.email, { redirectTo: redirectTo || undefined });
          if (rr && rr.error) {
            inviteMsg = `invite failed: ${msg}; reset failed: ${rr.error.message || rr.error}`;
          } else {
            inviteOk = true;
            inviteMsg = 'existing user: reset email sent';
          }
        } else {
          inviteMsg = msg;
        }
      } else {
        inviteOk = true;
        inviteMsg = 'invited';
        // optional: set metadata
        try {
          if (inv && inv.user && inv.user.id) {
            await sb.auth.admin.updateUserById(inv.user.id, { user_metadata: { nama: sanitizeNama(req.nama, req.email), nik: req.nik || null } });
          }
        } catch (e) {}
      }
    } catch (e) {
      inviteMsg = e.message || String(e);
    }

    // 3) Mark request approved
    const { error: uerr } = await sb
      .from('sigaji_registration_requests')
      .update({ status: 'approved', note: note || null, decided_at: decidedAt, decided_by: caller.user.id })
      .eq('tenant_key', tenant)
      .eq('id', id);
    if (uerr) return json(500, { ok: false, error: uerr.message });

    return json(200, { ok: true, status: 'approved', invited: inviteOk, invite_message: inviteMsg });
  } catch (e) {
    return json(500, { ok: false, error: e.message || String(e) });
  }
};

