# Kirim slip gaji massal lewat email

SiGaji mengirim PDF slip dari server (`/api/slip-email-send`), bukan `mailto:` di browser.

## Penting: Cloudflare + SMTP Hostinger

Jika error seperti:

```text
detail: "Error: proxy request failed, cannot connect to the specified address"
```

artinya **Cloudflare Workers tidak bisa membuka koneksi TCP** ke `smtp.hostinger.com`. Ini **bukan** salah password; port 587/465 dari Cloudflare tetap gagal.

**Telegram tetap jalan** karena pakai API HTTPS, bukan SMTP.

Pilih **salah satu** solusi di bawah (disarankan **A** jika Netlify masih aktif).

---

## Solusi A — Relay Netlify (pakai SMTP Hostinger seperti dulu)

SiGaji di **cemerlang.online** (Cloudflare) meneruskan kirim email ke function **Netlify** yang memakai `nodemailer` + SMTP Hostinger.

### 1. Pastikan Netlify masih deploy `netlify/functions/slip-email-send.js`

Contoh URL function: `https://sigaji.netlify.app/.netlify/functions/slip-email-send`

### 2. Environment di **Netlify** (sama seperti dulu)

| Variable | Contoh |
|----------|--------|
| `SIGAJI_SUPABASE_URL` | (sama) |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | (sama) |
| `SIGAJI_SMTP_HOST` | `smtp.hostinger.com` |
| `SIGAJI_SMTP_PORT` | `587` |
| `SIGAJI_SMTP_SECURE` | `false` |
| `SIGAJI_SMTP_USER` | `admin@cemerlang.online` |
| `SIGAJI_SMTP_PASS` | password mailbox |
| `SIGAJI_SMTP_FROM` | `SiGaji HR <admin@cemerlang.online>` |

Deploy ulang Netlify setelah set env.

### 3. Environment di **Cloudflare Pages** (Production)

| Variable | Nilai |
|----------|--------|
| `SIGAJI_EMAIL_PROVIDER` | `relay` |
| `SIGAJI_EMAIL_RELAY_URL` | `https://sigaji.netlify.app/.netlify/functions/slip-email-send` |

Variabel `SIGAJI_SMTP_*` di Cloudflare **tidak dipakai** saat mode relay (boleh dibiarkan).

Redeploy Cloudflare → tes kirim slip email.

---

## Solusi B — Resend (HTTP, tanpa Netlify)

1. Daftar di [resend.com](https://resend.com), buat API key.
2. Verifikasi domain `cemerlang.online` (tambah record DNS di Cloudflare sesuai panduan Resend).
3. Cloudflare env:

| Variable | Nilai |
|----------|--------|
| `SIGAJI_EMAIL_PROVIDER` | `resend` |
| `SIGAJI_RESEND_API_KEY` | `re_...` |
| `SIGAJI_RESEND_FROM` | `SiGaji <admin@cemerlang.online>` |

Redeploy → tes kirim slip.

---

## Env wajib (semua mode)

| Variable | Keterangan |
|----------|------------|
| `SIGAJI_SUPABASE_URL` | Supabase |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | Functions `/api/*` |

Build Cloudflare: `npm install && npm run build`

---

## Di aplikasi

Menu **Slip Gaji** → **Kirim slip ke banyak karyawan** → centang → **Kirim email terpilih**.

**Tes SMTP** hanya untuk mode SMTP langsung di Cloudflare — akan gagal jika Hostinger diblokir; setelah relay/Resend, tes lewat kirim satu slip.

## Supabase — riwayat kirim

Jalankan `sql/supabase_sigaji_slip_email_sent.sql` + grant di `sql/supabase_data_api_grants.sql`.

## Batas pengiriman

Hostinger/Resend membatasi jumlah email per jam. Kirim berurutan (~0,6 detik/orang).
