# Kuota karyawan — hanya penjual yang mengatur

Setup klien PT baru (deploy, DNS, Resend): **`ONBOARDING_KLIEN_PT.md`**.  
Multi-tenant & tenant ke-2 di Supabase yang sama: **`MULTI_TENANT_HOSTED.md`** + `sql/supabase_tenant_add.sql`.


Admin perusahaan **pelanggan** tidak bisa mengubah kuota di aplikasi. Mereka hanya melihat badge (mis. `Basic · 18 / 20`).

## Di mana tampil di aplikasi?

| Lokasi | Role | Yang terlihat |
|--------|------|----------------|
| **Master Karyawan** | Admin / HRD | Badge di kanan kotak cari: `Basic · 18 / 20 karyawan aktif` |
| **Master Perusahaan → Profil Perusahaan** | Admin / HRD | Kartu **Informasi paket (kuota)** |

Login **Karyawan** tidak melihat kuota. Setelah ubah di Supabase: login awan ulang + **Ctrl+F5**.

## Kuota tidak muncul?

1. Jalankan SQL tabel + lisensi (lihat §1 di bawah).
2. Set kuota lewat **SQL Editor** (`sql/supabase_tenant_license_set_vendor.sql`) — **bukan** Table Editor (nilai balik NULL).
3. Login **awan** (bukan hanya sandi lokal).
4. Atau set `SIGAJI_MAX_EMPLOYEES=20` di Cloudflare env + redeploy.

Cek di Console: `sigajiGetEffectiveMaxEmployees()` → harus > 0.

## 1. Supabase — set kuota (bukan Table Editor)

Trigger melindungi kuota: isi `20` di **Table Editor** → simpan → kembali **NULL** (disengaja, agar Admin PT tidak bisa naikkan sendiri).

**Langkah:**

1. Jalankan: `sql/supabase_tenant_license.sql`
2. Jalankan ulang: `sql/supabase_tenant_license_vendor_only.sql` (versi terbaru — izinkan SQL Editor / `postgres`)
3. Jalankan: **`sql/supabase_tenant_license_set_vendor.sql`** (sesuaikan `20` / `Basic` di file jika perlu)
4. Verifikasi: `select tenant_key, max_employees, plan_label from sigaji_tenant_meta;`

`NULL` / kosong pada `max_employees` = tidak dibatasi.

## 2. API license-set (Cloudflare atau Netlify)

Environment di **Cloudflare Pages** (atau Netlify):

| Variable | Contoh |
|----------|--------|
| `SIGAJI_LICENSE_ADMIN_SECRET` | string rahasia panjang |
| `SIGAJI_SUPABASE_URL` | (sudah ada) |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | (sudah ada) |

Contoh (PowerShell), ganti URL & secret:

```powershell
$body = '{"maxEmployees":20,"planLabel":"Basic"}'
Invoke-RestMethod -Method POST `
  -Uri "https://www.cemerlang.online/api/license-set" `
  -Headers @{ Authorization = "Bearer RAHASIA_ANDA" } `
  -ContentType "application/json" `
  -Body $body
```

(Netlify lama: `/.netlify/functions/license-set`)

## 3. Saat deploy per klien (opsional)

Di `js/config.js` (Anda yang pegang deploy, bukan pelanggan):

```javascript
window.SIGAJI_MAX_EMPLOYEES = 20;
window.SIGAJI_LICENSE_READONLY = true;
```

Ini mengunci di browser; tetap disarankan juga set di Supabase (trigger melindungi dari manipulasi API).

## Setelah ubah kuota

Minta pelanggan **refresh** halaman (Ctrl+F5). Kuota dibaca dari cloud saat sinkron.
