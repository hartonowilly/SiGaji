const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { json, requireEnv, getTenantKey } = require('./_shared');

function sbAdmin() {
  const url = requireEnv('SIGAJI_SUPABASE_URL');
  const key = requireEnv('SIGAJI_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function assertCallerIsHrdOrAdmin(sb, jwt, tenant) {
  if (!jwt) throw new Error('Missing Authorization bearer token');
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u || !u.user) throw new Error('Invalid auth token');
  const { data: row, error: re } = await sb.from('sigaji_cloud').select('payload').eq('tenant_key', tenant).maybeSingle();
  if (re) throw new Error(re.message);
  const payload = row && row.payload;
  const users = (payload && payload.users) || [];
  const me = users.find(
    (x) => x && x.email && String(x.email).toLowerCase() === String(u.user.email || '').toLowerCase()
  );
  const role = me && me.role;
  if (role !== 'Admin' && role !== 'HRD') throw new Error('Forbidden');
  return { user: u.user, role };
}

function getMailTransport() {
  const host = requireEnv('SIGAJI_SMTP_HOST');
  const user = requireEnv('SIGAJI_SMTP_USER');
  const pass = requireEnv('SIGAJI_SMTP_PASS');
  const port = parseInt(process.env.SIGAJI_SMTP_PORT || '465', 10);
  const secure = process.env.SIGAJI_SMTP_SECURE !== 'false' && port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(port === 587 ? { requireTLS: true } : {}),
  });
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
    const msg = e.message || String(e);
    if (/Missing env: SIGAJI_SMTP/i.test(msg)) {
      return json(503, {
        ok: false,
        error: 'SMTP belum dikonfigurasi di Netlify (SIGAJI_SMTP_HOST, USER, PASS).',
      });
    }
    return json(500, { ok: false, error: msg });
  }
};
