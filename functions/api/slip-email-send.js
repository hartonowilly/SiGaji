import nodemailer from 'nodemailer';
import {
  createSbAdmin,
  getTenantKey,
  requireEnv,
  envStr,
  jsonResponse,
  handleOptions,
  assertCallerIsHrdOrAdmin,
} from '../_lib/cf-shared.js';

function getMailTransport(env) {
  const host = requireEnv(env, 'SIGAJI_SMTP_HOST');
  const user = requireEnv(env, 'SIGAJI_SMTP_USER');
  const pass = requireEnv(env, 'SIGAJI_SMTP_PASS');
  const port = parseInt(envStr(env, 'SIGAJI_SMTP_PORT', '587'), 10);
  const secureEnv = envStr(env, 'SIGAJI_SMTP_SECURE', '').toLowerCase();
  let secure;
  if (secureEnv === 'true') secure = true;
  else if (secureEnv === 'false') secure = false;
  else secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    ...(port === 587 && !secure ? { requireTLS: true } : {}),
  });
}

function friendlySmtpError(e) {
  const msg = (e && (e.message || e.response)) || String(e);
  const code = e && e.code;
  if (code === 'EAUTH' || /535|authentication failed|invalid login/i.test(msg)) {
    return 'Login SMTP ditolak — periksa SIGAJI_SMTP_USER dan SIGAJI_SMTP_PASS di Cloudflare Pages.';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || /ECONNREFUSED|ETIMEOUT|connect/i.test(msg)) {
    return 'Tidak bisa terhubung ke SMTP — coba SIGAJI_SMTP_PORT=587 dan SIGAJI_SMTP_SECURE=false (Hostinger: smtp.hostinger.com).';
  }
  return msg;
}

function getFromAddress(env) {
  const from = envStr(env, 'SIGAJI_SMTP_FROM', '');
  if (from) return from;
  const user = envStr(env, 'SIGAJI_SMTP_USER', '');
  return user ? `"SiGaji" <${user}>` : 'SiGaji';
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

    const transport = getMailTransport(env);
    const info = await transport.sendMail({
      from: getFromAddress(env),
      to,
      subject,
      text: text || 'Berikut lampiran slip gaji Anda.',
      attachments: [
        {
          filename,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    return jsonResponse(
      200,
      {
        ok: true,
        email: true,
        messageId: info && info.messageId,
        to,
        nik: nik || undefined,
      },
      request
    );
  } catch (e) {
    const raw = e.message || String(e);
    if (/Missing env: SIGAJI_SMTP/i.test(raw)) {
      return jsonResponse(
        503,
        {
          ok: false,
          error:
            'SMTP belum dikonfigurasi di Cloudflare (SIGAJI_SMTP_HOST, SIGAJI_SMTP_USER, SIGAJI_SMTP_PASS).',
        },
        request
      );
    }
    if (/Forbidden|Invalid auth|Missing Authorization/i.test(raw)) {
      return jsonResponse(403, { ok: false, error: raw }, request);
    }
    return jsonResponse(500, { ok: false, error: friendlySmtpError(e) }, request);
  }
}
