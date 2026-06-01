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
