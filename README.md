# SiGaji

Aplikasi payroll Indonesia (gaji, THR, PPh 21, slip PDF/email/Telegram, sinkron cloud Supabase).

## Untuk siapa repo ini?

| Peran | Mulai di |
|--------|----------|
| **Penjual / vendor** (jual ke banyak PT, 1 Supabase) | [docs/MULTI_TENANT_HOSTED.md](docs/MULTI_TENANT_HOSTED.md) |
| **Onboarding klien PT** (deploy, DNS, Resend) | [docs/ONBOARDING_KLIEN_PT.md](docs/ONBOARDING_KLIEN_PT.md) |
| **Fork per perusahaan** (repo beda, basis sama) | [docs/README-FORK.md](docs/README-FORK.md) |
| **Kuota karyawan** (hanya penjual) | [docs/KUOTA_LISENSI_PENJUAL.md](docs/KUOTA_LISENSI_PENJUAL.md) |
| **Pegawai tetap / tidak tetap (NIK K vs NT)** | [docs/KARYAWAN_TIDAK_TETAP.md](docs/KARYAWAN_TIDAK_TETAP.md) |
| **Deploy Cloudflare + GitHub** | [docs/DEPLOY_GITHUB_CLOUDFLARE.md](docs/DEPLOY_GITHUB_CLOUDFLARE.md) |
| **Env & config.js** | [docs/REPO_PUBLIK_DAN_CONFIG.md](docs/REPO_PUBLIK_DAN_CONFIG.md) |

## Menjalankan lokal

```bash
npm install
cp js/config.example.js js/config.js   # isi URL + anon key Supabase
npm run build                          # salin vendor Supabase + config (jika env ada)
# Buka index.html lewat HTTP (Live Server / npx serve), bukan file://
```

Build wajib di Cloudflare: `npm install && npm run build`.

## Dokumentasi lengkap

Lihat **[docs/README.md](docs/README.md)** — indeks semua panduan.

## SQL Supabase

Urutan skrip dan tambah tenant baru: **[sql/README.md](sql/README.md)**.

## Tenant kedua (ringkas)

1. Ganti `__TENANT_KEY__` di `sql/supabase_tenant_add.sql` → jalankan di SQL Editor.
2. Duplicate project Cloudflare → `SIGAJI_TENANT_KEY=<key>` (Supabase URL/key **sama**).
3. Detail: [docs/MULTI_TENANT_HOSTED.md](docs/MULTI_TENANT_HOSTED.md#langkah-menambah-tenant-ke-2-ke-3--dst).
