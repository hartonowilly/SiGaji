# Deploy — backup database dari web SiGaji

## File yang harus ikut ke Netlify

- `netlify/functions/backup-database-export.js`
- `index.html` (tombol backup cloud)
- `js/app.js` (fungsi `exportCloudDatabaseBackup`)

## Environment variables Netlify (wajib)

Sama seperti fungsi Telegram / registrasi:

| Variable | Keterangan |
|----------|------------|
| `SIGAJI_SUPABASE_URL` | URL proyek Supabase |
| `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` | Service role (rahasia, hanya server) |
| `SIGAJI_TENANT_KEY` | Opsional, default `main` |

Tanpa **service role**, tombol akan error 500.

## Cara pakai (production)

1. Deploy → tunggu Netlify selesai build
2. Login SiGaji online (email Supabase) sebagai **Admin** atau **HRD**
3. Menu **Backup & Import**
4. Klik **Unduh backup database (cloud)**
5. File `Sigaji_DB_Export_main_....json` tersimpan di laptop

## Isi file

```json
{
  "_meta": { "type": "sigaji_database_export_v1", "row_counts": { ... } },
  "tables": {
    "sigaji_karyawan": [ ... ],
    "sigaji_periode": [ ... ],
    "sigaji_store": [ ... ]
  },
  "sigaji_cloud_legacy": { ... }
}
```

Centang **tanpa logo** memperkecil ukuran file.

## Bukan

- Bukan `pg_dump` / file `.dump`
- Bukan restore satu klik (gunakan import JSON aplikasi atau bantuan admin)
