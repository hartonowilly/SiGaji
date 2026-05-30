const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey, assertCallerIsHrdOrAdmin } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getMailTransport() {
  const host = requireEnv('SIGAJI_SMTP_HOST');
  const user = requireEnv('SIGAJI_SMTP_USER');
  const pass = requireEnv('SIGAJI_SMTP_PASS');
  const port = parseInt(process.env.SIGAJI_SMTP_PORT || '587', 10);
  const secureEnv = String(process.env.SIGAJI_SMTP_SECURE || '').trim().toLowerCase();
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
    return 'Login SMTP ditolak — periksa SIGAJI_SMTP_USER dan SIGAJI_SMTP_PASS di Netlify (Hostinger: gunakan password email penuh).';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || /ECONNREFUSED|ETIMEOUT|connect/i.test(msg)) {
    return (
      'Tidak bisa terhubung ke server SMTP — coba SIGAJI_SMTP_PORT=587 dan SIGAJI_SMTP_SECURE=false (Hostinger: smtp.hostinger.com).'
    );
  }
  return msg;
}

function getFromAddress() {
  const from = (process.env.SIGAJI_SMTP_FROM || '').trim();
  if (from) return from;
  const user = (process.env.SIGAJI_SMTP_USER || '').trim();
  return user ? `"SiGaji" <${user}>` : 'SiGaji';
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

    const tenant = getTenantKey();
    const sb = sbAdmin();
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await assertCallerIsHrdOrAdmin(sb, jwt, tenant);

    const body = JSON.parse(event.body || '{}');
    const to = String(body.to || '').trim().toLowerCase();
    const subject = String(body.subject || 'Slip gaji').trim() || 'Slip gaji';
    const text = String(body.text || body.bodyText || '').trim();
    const filename = String(body.filename || 'Slip.pdf').trim() || 'Slip.pdf';
    const pdfBase64 = String(body.pdfBase64 || '');
    const nik = String(body.nik || '').trim();

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json(400, { ok: false, error: 'Alamat email penerima tidak valid' });
    }
    if (!pdfBase64) return json(400, { ok: false, error: 'pdfBase64 required' });

    const transport = getMailTransport();
    const info = await transport.sendMail({
      from: getFromAddress(),
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

    return json(200, {
      ok: true,
      email: true,
      messageId: info && info.messageId,
      to,
      nik: nik || undefined,
    });
  } catch (e) {
    const raw = e.message || String(e);
    if (/Missing env: SIGAJI_SMTP/i.test(raw)) {
      return json(503, {
        ok: false,
        error: 'SMTP belum dikonfigurasi di Netlify (SIGAJI_SMTP_HOST, USER, PASS).',
      });
    }
    if (/Forbidden|Invalid auth|Missing Authorization/i.test(raw)) {
      return json(403, { ok: false, error: raw });
    }
    return json(500, { ok: false, error: friendlySmtpError(e) });
  }
};
