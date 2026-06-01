# Cloudflare “build sukses” tapi situs masih Netlify / v11.2.0

## Penyebab

Cloudflare Pages **hanya meng-deploy isi GitHub**, bukan folder di laptop (`Downloads\sigaji-app`) kecuali sudah di-**push**.

Cek cepat (View Page Source di browser):

| Yang terlihat | Artinya |
|---------------|---------|
| `app-access.js?v=11.2.0` + `fn-api.js` | Repo Git **belum** berisi perbaikan terbaru |
| `SIGAJI_BUILD='11.2.2'` di `<head>` | **Sudah** deploy `index.html` baru |
| Request ke `/.netlify/functions/` | `app-access.js` lama (shim di `index.html` mengarahkan ke `/api/` jika build 11.2.2 sudah live) |

## Pengaturan Cloudflare Pages

1. **Production branch:** `main` (sama dengan branch yang Anda push).
2. **Root directory:** `sigaji-app` (jika di repo file ada di subfolder `sigaji-app/`).
   - Jika semua file di **root** repo (tanpa subfolder), Root directory = **kosong**.
3. Setelah push, buka deployment terbaru → pastikan commit hash sama dengan `git log -1` di laptop.

## Push dari laptop (disarankan)

```powershell
cd C:\Users\harto\Downloads\sigaji-app
.\scripts\sync-push-github.ps1
```

Atau manual:

```powershell
robocopy C:\Users\harto\Downloads\sigaji-app C:\Users\harto\Downloads\SiGaji\sigaji-app /MIR /XD .git node_modules SiGaji sigaji-app
cd C:\Users\harto\Downloads\SiGaji
git add sigaji-app
git commit -m "deploy: 11.2.2 Cloudflare /api"
git push origin main
```

## Verifikasi setelah deploy

1. `Ctrl+F5` di https://www.cemerlang.online/
2. View Source → cari `SIGAJI_BUILD='11.2.2'`
3. F12 → Network → Permintaan registrasi → URL harus `/api/auth-registration-list`
