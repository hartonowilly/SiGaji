import { jsonResponse, handleOptions } from '../_lib/cf-shared.js';

/** GET /api/health — cek Functions Cloudflare aktif (tanpa Supabase). */
export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

export async function onRequestGet({ request }) {
  return jsonResponse(200, { ok: true, service: 'sigaji-api' }, request);
}
