# Cloudflare Pages Functions — Daftar Email

SiGaji di **Cloudflare Pages** memakai prefix **`/api/`** (bukan `/netlify/functions/`) agar tidak bentrok dengan folder statis `netlify/functions/` di deploy.

| Endpoint | Method |
|----------|--------|
| `/api/auth-register-request` | POST — permintaan daftar (publik) |
| `/api/auth-registration-list` | GET — daftar pending (Admin/HRD + Bearer) |
| `/api/auth-registration-decide` | POST — approve/reject + undangan Supabase |
| `/api/backup-database-export` | GET — unduh backup DB cloud (Admin/HRD + Bearer), query `?exclude_logo=1` opsional |
| `/api/slip-email-send` | POST — kirim slip PDF lewat SMTP (Admin/HRD + Bearer) |
| `/api/slip-email-ping` | POST — tes koneksi SMTP tanpa kirim email (Admin/HRD + Bearer) |
| `/api/telegram-send-slip` | POST — kirim slip PDF ke Telegram (Admin/HRD + Bearer) |
| `/api/telegram-create-link` | POST — buat kode link Telegram untuk NIK |
| `/api/license-set` | POST — atur kuota lisensi (Bearer `SIGAJI_LICENSE_ADMIN_SECRET`, penjual saja) |

Di **Netlify** tetap `/.netlify/functions/...`. Browser memilih prefix lewat `js/fn-api.js` (`*.pages.dev`, `*.cemerlang.online` → `/api`).

## Environment variables (Cloudflare Pages)

**Workers & Pages → proyek → Settings → Environment variables** — tambahkan untuk **Production** (variabel dipakai saat **build** dan saat **Functions** jalan).

| Nama | Wajib | Keterangan |
|------|-------|------------|
| `SIGAJI_SUPABASE_URL` | Ya | URL proyek Supabase |
| `SIGAJI_SUPABASE_ANON_KEY` | Ya | Anon/public key → `js/config.js` (login browser) |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | Ya | Service role → Functions `/api/*` (rahasia) |
| `SIGAJI_TENANT_KEY` | Opsional | Default `main` |
| `SIGAJI_SITE_URL` | Disarankan | `https://www.cemerlang.online/` — redirect undangan email |
| `SIGAJI_SMTP_HOST` | Untuk email slip | `smtp.hostinger.com` |
| `SIGAJI_SMTP_PORT` | Opsional | `587` |
| `SIGAJI_SMTP_SECURE` | Opsional | `false` (port 587) |
| `SIGAJI_SMTP_USER` | Untuk email slip | email mailbox Hostinger |
| `SIGAJI_SMTP_PASS` | Untuk email slip | password mailbox |
| `SIGAJI_SMTP_FROM` | Opsional | `SiGaji HR <admin@...>` |
| `SIGAJI_TELEGRAM_BOT_TOKEN` | Untuk Telegram slip | token dari @BotFather |

Ambil dari **Supabase → Project Settings → API**. Detail SMTP: `docs/SLIP_EMAIL_SMTP.md`. Tanpa URL + anon key, `npm run build` gagal (atau deploy dengan config kosong — login/daftar tidak jalan).

**Root directory** di Builds & deployments:

| Struktur GitHub | Root directory Cloudflare |
|-----------------|---------------------------|
| `index.html` langsung di root repo (push dari folder `sigaji-app` lokal) | **kosong** `/` |
| `SiGaji/sigaji-app/index.html` (monorepo) | `sigaji-app` |

Commit terbaru memakai **root repo** — jangan isi `sigaji-app` (error: `Cannot find cwd: .../sigaji-app`).

## Build

- **Build command:** `npm install && npm run build` (wajib env URL + anon di atas)
- **nodejs_compat + output:** `wrangler.toml` di root repo (`pages_build_output_dir = "."`)
- Dependencies: `@supabase/supabase-js` di `package.json` (di-bundle saat deploy Functions)

## Supabase

Tabel `sigaji_registration_requests` harus sudah ada (skema sama dengan deploy Netlify).

Setelah domain custom aktif, set `SIGAJI_SITE_URL` ke `https://www.cemerlang.online/` dan tambahkan URL itu di **Supabase → Authentication → Redirect URLs**.

DNS apex `cemerlang.online` masih ke Netlify? Lihat **`docs/DNS_CEMERLANG_CLOUDFLARE.md`**.

## Uji cepat

1. Deploy ulang dari Git setelah push.
2. Buka https://sigaji.pages.dev → form **Daftar** → kirim email.
3. Login Admin/HRD → **User & Akses → Permintaan registrasi** → Approve.
4. Cek email undangan/reset dari Supabase.

Jika daftar email gagal dan Network tab menampilkan **HTML** (bukan JSON), API tidak ter-route — deploy ulang dengan `functions/api/` dan pastikan **nodejs_compat** aktif.

Uji: `POST https://sigaji.pages.dev/api/auth-register-request` harus mengembalikan JSON, bukan halaman login.
