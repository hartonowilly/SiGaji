# Deploy GitHub + Cloudflare — cek daftar email

## Build gagal: `ENOENT package.json` di `/repo/`

Log:

```text
npm error path /opt/buildhome/repo/package.json
npm error enoent Could not read package.json
```

**Penyebab:** di GitHub, `package.json` ada di **`sigaji-app/package.json`**, bukan di root repo. Cloudflare **Root directory** masih kosong.

**Perbaikan (Cloudflare dashboard):**

1. **Workers & Pages** → proyek **sigaji** → **Settings** → **Build**
2. **Root directory** → ketik: **`sigaji-app`** (tanpa slash)
3. **Build command** → `npm install && npm run build`
4. **Save** → **Deployments** → **Retry deployment**

Jangan upload ZIP lewat GitHub web saja — pakai **`git push`** dari laptop agar `functions/`, `wrangler.toml`, `fn-api.js` ikut ter-upload.

---

## Kenapa domain Active tapi email gagal?

Biasanya **kode di GitHub ≠ kode di laptop**, atau **Functions `/api/` tidak ikut deploy**.

### Cek GitHub (hartonowilly/SiGaji)

Harus ada (di folder yang dipakai Cloudflare):

- `functions/api/auth-register-request.js`
- `functions/api/health.js`
- `wrangler.toml` (`nodejs_compat`)
- `index.html` dengan script `submitRegisterRequest` + `/api/`
- `js/fn-api.js`

Commit **"Add files via upload"** lama sering **tidak** berisi `functions/api/` → `/api/health` mengembalikan **HTML** → `fetch().json()` SyntaxError.

**Sementara Functions belum deploy:** jalankan `sql/supabase_registration_anon_insert.sql` di Supabase — daftar email lewat klien Supabase (versi `index.html` terbaru).

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

## Jangan buka `/api/health` sebagai “halaman app”

URL itu untuk **API** (JSON), bukan UI. Jika Cloudflare mengembalikan `index.html` di `/api/health`, browser memuat script dari `/api/js/...` → halaman tanpa CSS (`NS_ERROR_CORRUPTED_CONTENT`).

- **Aplikasi:** `https://www.cemerlang.online/` (pakai `/` di akhir)
- **Cek JSON:** tab baru → `https://www.cemerlang.online/api/health` → harus hanya teks `{"ok":true,"service":"sigaji-api"}` (bukan form login)

**Tidak ada** menu “matikan SPA” di Cloudflare Settings. Pages otomatis mode SPA jika **tidak ada** file `404.html` di root deploy — semua URL tidak dikenal dilayani `index.html` (termasuk `/api/health` → SyntaxError JSON).

**Solusi:** commit file `404.html` di root proyek (sudah ada di repo). Setelah deploy, URL asing dapat 404, bukan halaman login penuh. Agar `/api/*` mengembalikan JSON, tetap wajib folder `functions/api/` + `wrangler.toml` di Git.

## Uji setelah deploy Success

1. `https://www.cemerlang.online/api/health` → JSON `{"ok":true,...}` (bukan halaman login)
2. F12 → Daftar Email → `POST .../api/auth-register-request` (bukan `/.netlify/functions/`)
3. View Page Source → cari teks `/api/auth-register-request` di bagian bawah `index.html`

---

## Dua struktur repo

| GitHub | Cloudflare Root directory |
|--------|---------------------------|
| `SiGaji/sigaji-app/index.html` | `sigaji-app` |
| `SiGaji/index.html` (flat) | kosong |

Jangan campur: root directory salah → build gagal atau file lama.
