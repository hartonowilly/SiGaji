# Migrasi Supabase — dari satu JSON ke tabel (Opsi 1)

## Yang berubah

| Sebelum | Sesudah |
|--------|---------|
| Satu baris `sigaji_cloud.payload` (seluruh app) | Tabel terpisah + opsional cadangan blob |
| Tunjangan variabel di dalam JSON | Baris di `sigaji_tunj_var_nilai` (per periode × NIK × kolom) |
| Karyawan di array JSON | Satu baris per NIK di `sigaji_karyawan` |

Aplikasi tetap memakai **localStorage** di browser; sync ke Supabase mengikuti mode di `config.js`.

## Langkah di Supabase (sekali)

1. Buka **SQL Editor** → jalankan isi file:
   - `sql/supabase_sigaji_tables_v11.sql`
2. Jalankan lagi (atau tambahkan baris GRANT baru):
   - `sql/supabase_data_api_grants.sql`
3. Branding halaman login (nama PT + logo dari Master Perusahaan, sebelum login):
   - `sql/supabase_login_branding_rpc.sql`
3. Pastikan migrasi tenant shared sudah ada (jika dipakai):
   - `sql/supabase_migrate_to_shared_payload.sql`

## Langkah di aplikasi

Di `js/config.js` (jangan di-commit ke Git publik):

```js
window.SIGAJI_STORAGE_MODE = 'dual';
```

| Mode | Perilaku |
|------|----------|
| `dual` | Baca dari **tabel**; tulis ke tabel + **cadangan** `sigaji_cloud` (aman saat migrasi) |
| `tables` | Hanya tabel (hemat ukuran blob) |
| `blob` | Perilaku lama (tanpa tabel) |

Deploy `index.html`, `js/cloud-tables.js`, `js/cloud-sync.js` ke Netlify → **Ctrl+F5**.

## Migrasi data otomatis

Saat login pertama kali setelah SQL dijalankan:

- Jika tabel **kosong** tetapi `sigaji_cloud` masih berisi data → isi tabel disalin sekali dari blob.
- Setelah itu, baca utama dari tabel.

## Cek di Supabase Table Editor

- `sigaji_karyawan` — jumlah baris ≈ jumlah karyawan
- `sigaji_periode` — satu baris per periode gaji
- `sigaji_tunj_var_nilai` — nilai tunjangan variabel (cocok untuk import massal / Excel nanti)
- `sigaji_store` — absensi, lembur, users, karSnapshot, dll. (satu dokumen per `store_key`)

## Import Excel tunjangan variabel

Belum ada tombol di UI; struktur tabel sudah siap. Format logis:

`periode_nama` | `nik` | `kolom_id` | `nilai`

Setelah import ke tabel (SQL/CSV/API), login ulang — aplikasi memuat ulang ke grid Tunjangan Variabel.

## Rollback

Set `SIGAJI_STORAGE_MODE = 'blob'` — aplikasi kembali hanya memakai `sigaji_cloud` (data blob cadangan di mode `dual` tetap ada).
