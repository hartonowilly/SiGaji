import {
  createSbAdmin,
  getTenantKey,
  jsonResponse,
  handleOptions,
} from '../_lib/cf-shared.js';
import {
  assertCallerWithNik,
  assertCallerIsHrdOrAdminMobile,
} from '../_lib/mobile-shared.js';

const MODEL_VERSION = 'mobilefacenet_v4';
const MIN_DIM = 128;
const MAX_DIM = 256;
const MIN_VERIFY_THRESHOLD = 0.76;

function validateEmbedding(raw) {
  if (!Array.isArray(raw) || raw.length < MIN_DIM || raw.length > MAX_DIM) {
    return null;
  }
  const out = raw.map((x) => Number(x));
  if (out.some((x) => !Number.isFinite(x))) return null;
  return out;
}

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

/** HRD: daftar status enrollment per karyawan */
export async function onRequestGet({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);

    const { data, error } = await sb
      .from('sigaji_face_enrollments')
      .select('nik,model_version,enrolled_at,updated_at')
      .eq('tenant_key', tenant)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    return jsonResponse(200, { ok: true, items: data || [] }, request);
  } catch (e) {
    const msg = e.message || String(e);
    if (/Forbidden|Invalid auth/i.test(msg)) {
      return jsonResponse(403, { ok: false, error: msg }, request);
    }
    if (/relation.*does not exist|sigaji_face_enrollments/i.test(msg)) {
      return jsonResponse(
        503,
        {
          ok: false,
          error: 'Tabel enrollment wajah belum ada — jalankan sql/supabase_sigaji_face_enrollment.sql',
        },
        request
      );
    }
    return jsonResponse(500, { ok: false, error: msg }, request);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'status').trim();

    if (action === 'delete') {
      const hrd = await assertCallerIsHrdOrAdminMobile(sb, jwt, tenant);
      const nik = String(body.nik || '').trim();
      if (!nik) return jsonResponse(400, { ok: false, error: 'nik wajib' }, request);
      const { error } = await sb
        .from('sigaji_face_enrollments')
        .delete()
        .eq('tenant_key', tenant)
        .eq('nik', nik);
      if (error) throw error;
      return jsonResponse(
        200,
        {
          ok: true,
          message: 'Enrollment wajah dihapus — karyawan perlu daftar ulang di HP',
          deleted_nik: nik,
          by: hrd.me.nama || hrd.me.username || 'HRD',
        },
        request
      );
    }

    const ctx = await assertCallerWithNik(sb, jwt, tenant);

    if (action === 'status') {
      const { data, error } = await sb
        .from('sigaji_face_enrollments')
        .select('model_version,enrolled_at,updated_at')
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .maybeSingle();
      if (error) throw error;
      const needsReenroll =
        !!data && String(data.model_version || '') !== MODEL_VERSION;
      return jsonResponse(
        200,
        {
          ok: true,
          enrolled: !!data,
          model_version: data ? data.model_version : null,
          enrolled_at: data ? data.enrolled_at : null,
          needs_reenroll: needsReenroll,
        },
        request
      );
    }

    if (action === 'get_embedding') {
      const { data, error } = await sb
        .from('sigaji_face_enrollments')
        .select('embedding,model_version,verify_threshold,updated_at')
        .eq('tenant_key', tenant)
        .eq('nik', ctx.nik)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return jsonResponse(
          404,
          { ok: false, error: 'Belum daftar wajah — lakukan enrollment dulu' },
          request
        );
      }
      if (String(data.model_version || '') !== MODEL_VERSION) {
        return jsonResponse(
          409,
          {
            ok: false,
            error: 'Model wajah usang — daftar ulang wajah di app terbaru',
            needs_reenroll: true,
          },
          request
        );
      }
      const vt = Number(data.verify_threshold);
      return jsonResponse(
        200,
        {
          ok: true,
          embedding: data.embedding,
          model_version: data.model_version,
          verify_threshold: Number.isFinite(vt) ? vt : MIN_VERIFY_THRESHOLD,
          updated_at: data.updated_at,
        },
        request
      );
    }

    if (action === 'enroll') {
      const embedding = validateEmbedding(body.embedding);
      if (!embedding) {
        return jsonResponse(
          400,
          { ok: false, error: 'embedding invalid (array ' + MIN_DIM + '–' + MAX_DIM + ' float)' },
          request
        );
      }
      const minSelf = Number(body.enroll_min_self_score);
      const verifyThreshold = Number(body.verify_threshold);
      if (!Number.isFinite(minSelf) || minSelf < 0.8) {
        return jsonResponse(
          400,
          { ok: false, error: 'enroll_min_self_score wajib (min 0.8)' },
          request
        );
      }
      const vt = Number.isFinite(verifyThreshold)
        ? Math.max(MIN_VERIFY_THRESHOLD, verifyThreshold)
        : MIN_VERIFY_THRESHOLD;

      const now = new Date().toISOString();
      const { data, error } = await sb
        .from('sigaji_face_enrollments')
        .upsert(
          {
            tenant_key: tenant,
            nik: ctx.nik,
            embedding,
            model_version: String(body.model_version || MODEL_VERSION).trim() || MODEL_VERSION,
            enroll_min_self_score: minSelf,
            verify_threshold: vt,
            updated_at: now,
          },
          { onConflict: 'tenant_key,nik' }
        )
        .select('id,enrolled_at,updated_at,model_version')
        .single();
      if (error) throw error;
      return jsonResponse(
        200,
        {
          ok: true,
          message: 'Wajah terdaftar — Anda bisa check-in/out',
          id: data && data.id,
          model_version: data && data.model_version,
          enrolled_at: data && data.enrolled_at,
        },
        request
      );
    }

    return jsonResponse(400, { ok: false, error: 'action tidak dikenal' }, request);
  } catch (e) {
    const msg = e.message || String(e);
    if (/Forbidden|Invalid auth|NIK/i.test(msg)) {
      return jsonResponse(403, { ok: false, error: msg }, request);
    }
    if (/relation.*does not exist|sigaji_face_enrollments/i.test(msg)) {
      return jsonResponse(
        503,
        {
          ok: false,
          error: 'Tabel enrollment wajah belum ada — jalankan sql/supabase_sigaji_face_enrollment.sql',
        },
        request
      );
    }
    return jsonResponse(500, { ok: false, error: msg }, request);
  }
}
