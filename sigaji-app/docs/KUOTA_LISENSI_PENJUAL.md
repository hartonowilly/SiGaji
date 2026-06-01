# Kuota karyawan — hanya penjual yang mengatur

Admin perusahaan **pelanggan** tidak bisa mengubah kuota di aplikasi. Mereka hanya melihat badge (mis. `Basic · 18 / 20`).

## 1. Supabase (paling mudah)

1. Jalankan SQL: `sql/supabase_tenant_license.sql` lalu `sql/supabase_tenant_license_vendor_only.sql`
2. Table Editor → `sigaji_tenant_meta` → baris `tenant_key` = `main` (atau tenant klien):

| Kolom | Contoh |
|--------|--------|
| `max_employees` | `20` |
| `plan_label` | `Basic` |

`NULL` / kosong pada `max_employees` = tidak dibatasi.

## 2. Netlify Function (dari luar, otomatis)

Environment variables di situs Netlify:

| Variable | Contoh |
|----------|--------|
| `SIGAJI_LICENSE_ADMIN_SECRET` | string rahasia panjang |
| `SIGAJI_SUPABASE_URL` | (sudah ada) |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | (sudah ada) |
| `SIGAJI_TENANT_KEY` | `main` |

Contoh (PowerShell), ganti URL & secret:

```powershell
$body = '{"maxEmployees":20,"planLabel":"Basic"}'
Invoke-RestMethod -Method POST `
  -Uri "https://cemerlang.online/.netlify/functions/license-set" `
  -Headers @{ Authorization = "Bearer RAHASIA_ANDA" } `
  -ContentType "application/json" `
  -Body $body
```

## 3. Saat deploy per klien (opsional)

Di `js/config.js` (Anda yang pegang deploy, bukan pelanggan):

```javascript
window.SIGAJI_MAX_EMPLOYEES = 20;
window.SIGAJI_LICENSE_READONLY = true;
```

Ini mengunci di browser; tetap disarankan juga set di Supabase (trigger melindungi dari manipulasi API).

## Setelah ubah kuota

Minta pelanggan **refresh** halaman (Ctrl+F5). Kuota dibaca dari cloud saat sinkron.
