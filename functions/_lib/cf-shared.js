/**
 * Utilitas bersama Cloudflare Pages Functions (registrasi email, dll.)
 * Env: set di Cloudflare Pages → Settings → Environment variables
 */
import { createClient } from '@supabase/supabase-js';

export function createSbAdmin(env) {
  const url = requireEnv(env, 'SIGAJI_SUPABASE_URL');
  const key = requireEnv(env, 'SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export function requireEnv(env, name) {
  const v = env && env[name];
  if (!v) throw new Error('Missing env: ' + name);
  return String(v).trim();
}

export function envStr(env, name, fallback) {
  const v = env && env[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

export function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function extractStartCode(text) {
  if (!text) return '';
  const t = String(text).trim();
  const m = t.match(/^\/start(?:@\w+)?\s+([A-Z2-9]{6,12})$/i);
  if (m) return String(m[1]).toUpperCase();
  const m2 = t.match(/^([A-Z2-9]{6,12})$/i);
  if (m2) return String(m2[1]).toUpperCase();
  return '';
}

export function getTenantKey(env) {
  const t = env && env.SIGAJI_TENANT_KEY;
  return (t && String(t).trim()) || 'main';
}

export function getSiteUrl(request, env) {
  const fromEnv = env && env.SIGAJI_SITE_URL ? String(env.SIGAJI_SITE_URL).trim() : '';
  if (fromEnv) return fromEnv.endsWith('/') ? fromEnv : fromEnv + '/';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || '';
  if (!host) return '';
  return proto + '://' + host + '/';
}

export function jsonResponse(status, body, request, extraHeaders) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders(request),
    ...(extraHeaders || {}),
  };
  return new Response(JSON.stringify(body), { status, headers });
}

export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function handleOptions(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function loadUsersForAuth(sb, tenant) {
  const { data: storeRow, error: se } = await sb
    .from('sigaji_store')
    .select('data')
    .eq('tenant_key', tenant)
    .eq('store_key', 'users')
    .maybeSingle();
  if (!se && storeRow && storeRow.data && Array.isArray(storeRow.data)) return storeRow.data;
  const { data: row, error: re } = await sb
    .from('sigaji_cloud')
    .select('payload')
    .eq('tenant_key', tenant)
    .maybeSingle();
  if (re) throw re;
  return (row && row.payload && row.payload.users) || [];
}

export function matchSigajiUserForAuth(users, authUser) {
  if (!authUser || !Array.isArray(users)) return null;
  const authEm = String(authUser.email || '').toLowerCase().trim();
  const authId = String(authUser.id || '').trim();
  return (
    users.find((x) => {
      if (!x || x.aktif === false) return false;
      if (authEm && x.email && String(x.email).toLowerCase().trim() === authEm) return true;
      if (authId && x.auth_uid && String(x.auth_uid) === authId) return true;
      return false;
    }) || null
  );
}

/** Port 587 + secure:true ditolak worker-mailer — pakai STARTTLS (secure:false, startTls:true). */
export function smtpTlsForPort(port, secureFlag) {
  const p = Number(port) || 587;
  const flag = String(secureFlag || '').toLowerCase();
  if (p === 465) {
    return { secure: true, startTls: false };
  }
  if (flag === 'true') {
    return { secure: false, startTls: true };
  }
  if (flag === 'false') {
    return { secure: false, startTls: true };
  }
  return { secure: false, startTls: true };
}

export function smtpConnectProfiles(env) {
  const host = requireEnv(env, 'SIGAJI_SMTP_HOST');
  const user = requireEnv(env, 'SIGAJI_SMTP_USER');
  const pass = requireEnv(env, 'SIGAJI_SMTP_PASS');
  const portEnv = parseInt(envStr(env, 'SIGAJI_SMTP_PORT', '587'), 10);
  const secureEnv = envStr(env, 'SIGAJI_SMTP_SECURE', '');
  const base = {
    host,
    username: user,
    password: pass,
    authType: ['login', 'plain'],
    logLevel: 'ERROR',
    socketTimeoutMs: 25000,
    responseTimeoutMs: 25000,
  };
  const profiles = [];
  const tlsMain = smtpTlsForPort(portEnv, secureEnv);
  profiles.push({
    label: `env port ${portEnv}`,
    opts: { ...base, port: portEnv, ...tlsMain },
  });
  if (portEnv !== 465) {
    profiles.push({
      label: 'fallback 465 SSL',
      opts: { ...base, port: 465, secure: true, startTls: false },
    });
  }
  if (portEnv !== 587) {
    profiles.push({
      label: 'fallback 587 STARTTLS',
      opts: { ...base, port: 587, secure: false, startTls: true },
    });
  }
  return profiles;
}

export function pdfBase64ToBytes(pdfBase64) {
  const raw = String(pdfBase64 || '').replace(/\s/g, '');
  if (!raw) return new Uint8Array(0);
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function friendlySmtpError(e) {
  const msg = (e && (e.message || e.response)) || String(e);
  const name = e && e.name;
  const code = e && e.code;
  if (name === 'ConfigurationError' || /invalid combination|port 587.*secure/i.test(msg)) {
    return (
      'Konfigurasi SMTP salah: port 587 pakai SIGAJI_SMTP_SECURE=false (STARTTLS). ' +
      'Port 465 pakai SIGAJI_SMTP_SECURE=true.'
    );
  }
  if (name === 'SmtpAuthError' || code === 'EAUTH' || /535|authentication failed|invalid login|auth/i.test(msg)) {
    return 'Login SMTP ditolak — periksa SIGAJI_SMTP_USER dan SIGAJI_SMTP_PASS di Cloudflare (password mailbox Hostinger penuh).';
  }
  if (
    name === 'SmtpConnectionError' ||
    /ETIMEDOUT|ESOCKET|ECONNREFUSED|ETIMEOUT|connect|socket|tcp/i.test(msg)
  ) {
    return (
      'Tidak bisa konek ke SMTP dari Cloudflare. Hostinger: smtp.hostinger.com port 587 + SIGAJI_SMTP_SECURE=false, ' +
      'atau port 465 + SIGAJI_SMTP_SECURE=true.'
    );
  }
  if (/nodemailer|node:net|node:tls|Cannot find module|No such module/i.test(msg)) {
    return 'Modul email belum ter-bundle — deploy ulang dengan npm install (@ryyr/worker-mailer) sukses.';
  }
  return msg;
}

export async function assertCallerIsHrdOrAdmin(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');
  const users = await loadUsersForAuth(sb, tenant);
  const me = matchSigajiUserForAuth(users, u.user);
  const role = me && me.role;
  if (role !== 'Admin' && role !== 'HRD') {
    throw new Error(
      'Forbidden — hanya Admin/HRD (pastikan email login sama dengan Email Supabase di Manajemen User, lalu sinkron data ke awan)'
    );
  }
  const { data: row } = await sb
    .from('sigaji_cloud')
    .select('payload')
    .eq('tenant_key', tenant)
    .maybeSingle();
  return { user: u.user, role, payload: (row && row.payload) || {} };
}
