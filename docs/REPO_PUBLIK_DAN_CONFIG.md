# Repo GitHub publik + `config.js` tanpa commit

## Prinsip

| Lokasi | Isi |
|--------|-----|
| **GitHub (publik)** | `js/config.example.js` saja — tanpa kunci asli |
| **`.gitignore`** | `js/config.js` tidak ikut push |
| **Netlify** | Saat deploy, script membuat `js/config.js` dari **Environment variables** |

## Langkah di Netlify (wajib)

Site settings → **Environment variables** → tambahkan:

| Variable | Contoh |
|----------|--------|
| `SIGAJI_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SIGAJI_SUPABASE_ANON_KEY` | anon key dari Supabase → API |

Opsional (sama seperti `config.example.js`):

- `SIGAJI_TENANT_KEY`
- `SIGAJI_MAX_EMPLOYEES`
- `SIGAJI_STORAGE_MODE` = `dual`
- `SIGAJI_RESUME_SESSION_ON_LOAD` = `true` atau `false`
- `SIGAJI_IDLE_LOGOUT_MINUTES` = `30`

Salin nilai dari `js/config.js` di laptop Anda (sekali), paste ke Netlify — **jangan** commit `config.js` ke GitHub.

Tetap set juga env untuk Functions: `SIGAJI_SUPABASE_SERVICE_ROLE_KEY`, `SIGAJI_SMTP_*`, dll.

## Build

`netlify.toml` menjalankan:

```bash
npm install && npm run build
```

`npm run build` → `scripts/generate-config.js` → file `js/config.js` ada di situs live.

## Develop di laptop

```powershell
copy js\config.example.js js\config.js
```

Isi URL + anon key, lalu buka / deploy lokal seperti biasa.

## Push ke GitHub

```powershell
git add .
git status
```

Pastikan **`js/config.js` tidak** muncul di daftar commit.
