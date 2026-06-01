import { WorkerMailer } from '@ryyr/worker-mailer';
import {
  createSbAdmin,
  getTenantKey,
  envStr,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
  smtpConnectProfiles,
} from '../_lib/cf-shared.js';

export async function onRequestOptions({ request }) {
  return handleOptions(request);
}

/** POST /api/slip-email-ping — tes koneksi SMTP (tanpa kirim email). */
export async function onRequestPost({ request, env }) {
  try {
    const tenant = getTenantKey(env);
    const sb = createSbAdmin(env);
    const auth = request.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const host = envStr(env, 'SIGAJI_SMTP_HOST', '');
    const user = envStr(env, 'SIGAJI_SMTP_USER', '');
    if (!host || !user) {
      return jsonResponse(
        503,
        {
          ok: false,
          error: 'SMTP belum lengkap (SIGAJI_SMTP_HOST, SIGAJI_SMTP_USER, SIGAJI_SMTP_PASS).',
        },
        request
      );
    }

    const profiles = smtpConnectProfiles(env);
    const results = [];
    for (const profile of profiles) {
      let mailer;
      try {
        mailer = await WorkerMailer.connect(profile.opts);
        results.push({ label: profile.label, ok: true });
      } catch (e) {
        results.push({
          label: profile.label,
          ok: false,
          error: (e && e.message) || String(e),
          name: e && e.name,
        });
      } finally {
        if (mailer) {
          try {
            await mailer.close();
          } catch (e) {
            /* ignore */
          }
        }
      }
      if (results[results.length - 1].ok) break;
    }

    const winner = results.find((r) => r.ok);
    return jsonResponse(
      winner ? 200 : 500,
      {
        ok: !!winner,
        host,
        user,
        port: envStr(env, 'SIGAJI_SMTP_PORT', '587'),
        secureEnv: envStr(env, 'SIGAJI_SMTP_SECURE', ''),
        attempts: results,
        hint: winner
          ? 'SMTP OK — coba kirim slip email lagi.'
          : 'Gagal semua profil. Coba port 465 + SIGAJI_SMTP_SECURE=true, atau port 587 + SIGAJI_SMTP_SECURE=false.',
      },
      request
    );
  } catch (e) {
    const raw = e.message || String(e);
    if (/Forbidden|Invalid auth|Missing Authorization/i.test(raw)) {
      return jsonResponse(403, { ok: false, error: raw }, request);
    }
    return jsonResponse(500, { ok: false, error: raw }, request);
  }
}
