import { WorkerMailer } from '@ryyr/worker-mailer';
import {
  createSbAdmin,
  getTenantKey,
  requireEnv,
  envStr,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
  smtpConnectProfiles,
  pdfBase64ToBytes,
  friendlySmtpError,
} from '../_lib/cf-shared.js';

function smtpFromAddress(env) {
  const from = envStr(env, 'SIGAJI_SMTP_FROM', '');
  if (from) return from;
  const user = envStr(env, 'SIGAJI_SMTP_USER', '');
  return user || 'SiGaji';
}

async function sendSlipViaSmtp(env, { to, subject, text, filename, pdfBase64 }) {
  const pdfBytes = pdfBase64ToBytes(pdfBase64);
  if (!pdfBytes.length) throw new Error('pdfBase64 kosong atau tidak valid');

  const profiles = smtpConnectProfiles(env);
  let lastErr;
  for (const profile of profiles) {
    let mailer;
    try {
      mailer = await WorkerMailer.connect(profile.opts);
      const result = await mailer.send({
        from: smtpFromAddress(env),
        to,
        subject,
        text: text || 'Berikut lampiran slip gaji Anda.',
        attachments: [
          {
            filename,
            content: pdfBytes,
            mimeType: 'application/pdf',
          },
        ],
      });
      return { ...result, smtpProfile: profile.label };
    } catch (e) {
      lastErr = e;
      const msg = (e && e.message) || '';
      const retryable =
        (e && e.name === 'SmtpConnectionError') ||
        /ETIMEDOUT|ESOCKET|ECONNREFUSED|ETIMEOUT|connect|socket/i.test(msg);
      if (!retryable) throw e;
    } finally {
      if (mailer) {
        try {
          await mailer.close();
        } catch (e) {
          /* ignore */
        }
      }
    }
  }
  throw lastErr || new Error('SMTP gagal (semua profil)');
}

/** Opsional: kirim lewat Resend HTTP API (tanpa SMTP TCP). */
async function sendSlipViaResend(env, { to, subject, text, filename, pdfBase64 }) {
  const key = requireEnv(env, 'SIGAJI_RESEND_API_KEY');
  const from = envStr(env, 'SIGAJI_RESEND_FROM', '') || envStr(env, 'SIGAJI_SMTP_FROM', '') || 'onboarding@resend.dev';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + key,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: text || 'Berikut lampiran slip gaji Anda.',
      attachments: [{ filename, content: pdfBase64 }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((j && j.message) || (j && j.error) || 'Resend API gagal HTTP ' + r.status);
  }
  return { messageId: j && j.id, provider: 'resend' };
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
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = await request.json().catch(() => ({}));
    const to = String(body.to || '').trim().toLowerCase();
    const subject = String(body.subject || 'Slip gaji').trim() || 'Slip gaji';
    const text = String(body.text || body.bodyText || '').trim();
    const filename = String(body.filename || 'Slip.pdf').trim() || 'Slip.pdf';
    const pdfBase64 = String(body.pdfBase64 || '');
    const nik = String(body.nik || '').trim();

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return jsonResponse(400, { ok: false, error: 'Alamat email penerima tidak valid' }, request);
    }
    if (!pdfBase64) return jsonResponse(400, { ok: false, error: 'pdfBase64 required' }, request);

    const payload = { to, subject, text, filename, pdfBase64 };
    let info;
    const useResend =
      envStr(env, 'SIGAJI_EMAIL_PROVIDER', '').toLowerCase() === 'resend' ||
      !!envStr(env, 'SIGAJI_RESEND_API_KEY', '');
    if (useResend) {
      info = await sendSlipViaResend(env, payload);
    } else {
      info = await sendSlipViaSmtp(env, payload);
    }

    return jsonResponse(
      200,
      {
        ok: true,
        email: true,
        messageId: info && (info.messageId || info.id),
        provider: (info && info.provider) || 'smtp',
        smtpProfile: info && info.smtpProfile,
        to,
        nik: nik || undefined,
      },
      request
    );
  } catch (e) {
    const raw = [e && e.name, e && e.message].filter(Boolean).join(': ') || String(e);
    if (/Missing env: SIGAJI_SMTP/i.test(raw)) {
      return jsonResponse(
        503,
        {
          ok: false,
          error:
            'SMTP belum dikonfigurasi di Cloudflare (SIGAJI_SMTP_HOST, SIGAJI_SMTP_USER, SIGAJI_SMTP_PASS). ' +
            'Atau pakai Resend: SIGAJI_EMAIL_PROVIDER=resend + SIGAJI_RESEND_API_KEY.',
        },
        request
      );
    }
    if (/Missing env: SIGAJI_RESEND/i.test(raw)) {
      return jsonResponse(503, { ok: false, error: raw }, request);
    }
    if (/Forbidden|Invalid auth|Missing Authorization/i.test(raw)) {
      return jsonResponse(403, { ok: false, error: raw }, request);
    }
    return jsonResponse(500, { ok: false, error: friendlySmtpError(e), detail: raw }, request);
  }
}
