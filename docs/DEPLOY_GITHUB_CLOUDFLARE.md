# Deploy GitHub + Cloudflare — cek daftar email

## Kenapa domain Active tapi email gagal?

Biasanya **kode di GitHub ≠ kode di laptop**, atau **Functions `/api/` tidak ikut deploy**.

### Cek GitHub (hartonowilly/SiGaji)

Harus ada (di folder yang dipakai Cloudflare):

- `functions/api/auth-register-request.js`
- `functions/api/health.js`
- `wrangler.toml` (`nodejs_compat`)
- `index.html` dengan script `submitRegisterRequest` + `/api/`
- `js/fn-api.js`

Commit **"Add files via upload"** lama sering **tidak** berisi `functions/api/` → daftar email gagal (405 ke `/.netlify/functions/`).

---

## Setup Cloudflare Pages

| Setting | Nilai |
|---------|--------|
| **Root directory** | `sigaji-app` jika di GitHub isinya `sigaji-app/index.html` |
| | **kosong** jika `index.html` langsung di root repo |
| **Build command** | `npm install && npm run build` |
| **Env** | `SIGAJI_SUPABASE_URL`, `SIGAJI_SUPABASE_ANON_KEY`, `SIGAJI_SUPABASE_SERVICE_ROLE_KEY`, `SIGAJI_SITE_URL` |

---

## Push dari laptop (disarankan)

```bash
cd c:\Users\harto\Downloads\sigaji-app
git remote -v
git add -A
git status
git commit -m "deploy: Cloudflare /api/ daftar email + functions"
git push origin main
```

Jika repo GitHub memakai subfolder `sigaji-app/`, clone repo lalu **salin seluruh isi** folder laptop ke `SiGaji/sigaji-app/` sebelum commit.

---

## Uji setelah deploy Success

1. `https://www.cemerlang.online/api/health` → JSON `{"ok":true,...}`
2. F12 → Daftar Email → `POST .../api/auth-register-request` (bukan `/.netlify/functions/`)
3. View Page Source → cari teks `/api/auth-register-request` di bagian bawah `index.html`

---

## Dua struktur repo

| GitHub | Cloudflare Root directory |
|--------|---------------------------|
| `SiGaji/sigaji-app/index.html` | `sigaji-app` |
| `SiGaji/index.html` (flat) | kosong |

Jangan campur: root directory salah → build gagal atau file lama.
