import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import { assertCallerWithNik } from '../_lib/mobile-shared.js';

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = 'sigaji-mobile';

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('heic')) return 'heic';
  return 'jpg';
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
    const ctx = await assertCallerWithNik(sb, jwt, tenant);

    const ct = (request.headers.get('content-type') || '').toLowerCase();
    let bytes;
    let mime = 'image/jpeg';
    let sub = 'attendance';

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      sub = String(form.get('subfolder') || 'attendance').trim() || 'attendance';
      if (!file || typeof file === 'string') {
        return jsonResponse(400, { ok: false, error: 'file wajib (form field file)' }, request);
      }
      mime = file.type || mime;
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await request.json().catch(() => ({}));
      sub = String(body.subfolder || 'attendance').trim() || 'attendance';
      const b64 = String(body.file_base64 || '').replace(/^data:[^;]+;base64,/, '');
      if (!b64) return jsonResponse(400, { ok: false, error: 'file_base64 atau multipart file wajib' }, request);
      mime = String(body.content_type || mime);
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    }

    if (!bytes || !bytes.length) {
      return jsonResponse(400, { ok: false, error: 'file kosong' }, request);
    }
    if (bytes.length > MAX_BYTES) {
      return jsonResponse(400, { ok: false, error: 'File max 5 MB' }, request);
    }

    const safeNik = String(ctx.nik).replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = extFromMime(mime);
    const path = `${tenant}/${sub}/${safeNik}/${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });

    if (upErr) {
      const msg = upErr.message || String(upErr);
      if (/bucket|not found|does not exist/i.test(msg)) {
        return jsonResponse(
          503,
          {
            ok: false,
            error:
              'Bucket sigaji-mobile belum ada — jalankan sql/supabase_storage_sigaji_mobile.sql di Supabase',
          },
          request
        );
      }
      if (/mime|type|not allowed/i.test(msg)) {
        return jsonResponse(
          400,
          { ok: false, error: 'Tipe file ditolak. Gunakan JPG/PNG/PDF. ' + msg },
          request
        );
      }
      if (/policy|row-level|403|JWT/i.test(msg)) {
        return jsonResponse(
          503,
          {
            ok: false,
            error: 'Storage policy — jalankan sql/supabase_storage_sigaji_mobile.sql lalu deploy ulang',
          },
          request
        );
      }
      return jsonResponse(500, { ok: false, error: msg }, request);
    }

    return jsonResponse(200, { ok: true, path, bucket: BUCKET }, request);
  } catch (e) {
    const msg = e.message || String(e);
    if (/Forbidden|Invalid auth|NIK/i.test(msg)) {
      return jsonResponse(403, { ok: false, error: msg }, request);
    }
    return jsonResponse(500, { ok: false, error: msg }, request);
  }
}
