const crypto = require('crypto');

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
  };
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getTenantKey() {
  return (process.env.SIGAJI_TENANT_KEY || 'main').trim() || 'main';
}

/** URL aplikasi untuk link email invite/reset (Supabase Auth). */
function getSiteUrl(event) {
  const env = (process.env.SIGAJI_SITE_URL || '').trim();
  if (env) return env.endsWith('/') ? env : env + '/';
  const proto = String((event && event.headers && event.headers['x-forwarded-proto']) || 'https')
    .split(',')[0]
    .trim() || 'https';
  const host = String((event && event.headers && event.headers.host) || '').trim();
  if (!host) return '';
  return `${proto}://${host}/`;
}

function randomCode() {
  // 8 chars base32-ish (avoid confusing chars)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function extractStartCode(text) {
  // accepts: "/start CODE" or "CODE"
  if (!text) return '';
  const t = String(text).trim();
  const m = t.match(/^\/start(?:@\w+)?\s+([A-Z2-9]{6,12})$/i);
  if (m) return String(m[1]).toUpperCase();
  const m2 = t.match(/^([A-Z2-9]{6,12})$/i);
  if (m2) return String(m2[1]).toUpperCase();
  return '';
}

/** Users untuk cek role: sigaji_store (tabel) lalu fallback sigaji_cloud.payload.users */
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

module.exports = {
  json,
  requireEnv,
  getTenantKey,
  getSiteUrl,
  randomCode,
  extractStartCode,
  loadUsersForAuth,
  assertCallerIsHrdOrAdmin,
};

