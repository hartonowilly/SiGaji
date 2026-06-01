# Cloudflare Pages Functions — Daftar Email

SiGaji di **Cloudflare Pages** memakai route yang sama dengan Netlify agar klien tidak perlu diubah banyak:

| Endpoint | Method |
|----------|--------|
| `/netlify/functions/auth-register-request` | POST — permintaan daftar (publik) |
| `/netlify/functions/auth-registration-list` | GET — daftar pending (Admin/HRD + Bearer) |
| `/netlify/functions/auth-registration-decide` | POST — approve/reject + undangan Supabase |

Di **Netlify** tetap `/.netlify/functions/...`. Browser memilih prefix otomatis lewat `js/fn-api.js` (`*.pages.dev` → `/netlify/functions`).

## Environment variables (Cloudflare Pages)

**Settings → Environment variables** (Production dan Preview), **Root directory** = `sigaji-app`:

| Nama | Wajib | Keterangan |
|------|-------|------------|
| `SIGAJI_SUPABASE_URL` | Ya | URL proyek Supabase |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | Ya | Service role (rahasia, hanya server) |
| `SIGAJI_TENANT_KEY` | Opsional | Default `main` |
| `SIGAJI_SITE_URL` | Disarankan | `https://sigaji.pages.dev/` — redirect undangan/reset password |

Nilai sama dengan yang dipakai di Netlify (`netlify.toml` / dashboard).

## Build

- **Build command:** `npm run build` (atau kosong jika tidak perlu generate-config di CI)
- **nodejs_compat:** `wrangler.toml` di root `sigaji-app`
- Dependencies: `@supabase/supabase-js` di `package.json` (di-bundle saat deploy Functions)

## Supabase

Tabel `sigaji_registration_requests` harus sudah ada (skema sama dengan deploy Netlify).

Setelah domain custom aktif, set `SIGAJI_SITE_URL` ke `https://www.cemerlang.online/` dan tambahkan URL itu di **Supabase → Authentication → Redirect URLs**.

## Uji cepat

1. Deploy ulang dari Git setelah push.
2. Buka https://sigaji.pages.dev → form **Daftar** → kirim email.
3. Login Admin/HRD → **User & Akses → Permintaan registrasi** → Approve.
4. Cek email undangan/reset dari Supabase.

Jika 404 pada `/netlify/functions/...`, pastikan folder `functions/` ikut deploy dan **Compatibility flags** menyertakan `nodejs_compat`.
