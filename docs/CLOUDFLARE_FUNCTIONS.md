# Cloudflare Pages Functions — Daftar Email

SiGaji di **Cloudflare Pages** memakai prefix **`/api/`** (bukan `/netlify/functions/`) agar tidak bentrok dengan folder statis `netlify/functions/` di deploy.

| Endpoint | Method |
|----------|--------|
| `/api/auth-register-request` | POST — permintaan daftar (publik) |
| `/api/auth-registration-list` | GET — daftar pending (Admin/HRD + Bearer) |
| `/api/auth-registration-decide` | POST — approve/reject + undangan Supabase |

Di **Netlify** tetap `/.netlify/functions/...`. Browser memilih prefix lewat `js/fn-api.js` (`*.pages.dev`, `*.cemerlang.online` → `/api`).

## Environment variables (Cloudflare Pages)

**Settings → Environment variables** (Production dan Preview).

**Root directory** di Builds & deployments:

| Struktur GitHub | Root directory Cloudflare |
|-----------------|---------------------------|
| `index.html` langsung di root repo (push dari folder `sigaji-app` lokal) | **kosong** `/` |
| `SiGaji/sigaji-app/index.html` (monorepo) | `sigaji-app` |

Commit terbaru memakai **root repo** — jangan isi `sigaji-app` (error: `Cannot find cwd: .../sigaji-app`).

| Nama | Wajib | Keterangan |
|------|-------|------------|
| `SIGAJI_SUPABASE_URL` | Ya | URL proyek Supabase |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | Ya | Service role (rahasia, hanya server) |
| `SIGAJI_TENANT_KEY` | Opsional | Default `main` |
| `SIGAJI_SITE_URL` | Disarankan | `https://sigaji.pages.dev/` — redirect undangan/reset password |

Nilai sama dengan yang dipakai di Netlify (`netlify.toml` / dashboard).

## Build

- **Build command:** `npm run build` (atau kosong jika tidak perlu generate-config di CI)
- **nodejs_compat + output:** `wrangler.toml` di root repo (`pages_build_output_dir = "."`)
- Dependencies: `@supabase/supabase-js` di `package.json` (di-bundle saat deploy Functions)

## Supabase

Tabel `sigaji_registration_requests` harus sudah ada (skema sama dengan deploy Netlify).

Setelah domain custom aktif, set `SIGAJI_SITE_URL` ke `https://www.cemerlang.online/` dan tambahkan URL itu di **Supabase → Authentication → Redirect URLs**.

## Uji cepat

1. Deploy ulang dari Git setelah push.
2. Buka https://sigaji.pages.dev → form **Daftar** → kirim email.
3. Login Admin/HRD → **User & Akses → Permintaan registrasi** → Approve.
4. Cek email undangan/reset dari Supabase.

Jika daftar email gagal dan Network tab menampilkan **HTML** (bukan JSON), API tidak ter-route — deploy ulang dengan `functions/api/` dan pastikan **nodejs_compat** aktif.

Uji: `POST https://sigaji.pages.dev/api/auth-register-request` harus mengembalikan JSON, bukan halaman login.
