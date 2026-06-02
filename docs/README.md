# Dokumentasi SiGaji

## Model bisnis & multi-tenant

| Dokumen | Isi |
|---------|-----|
| **[MULTI_TENANT_HOSTED.md](MULTI_TENANT_HOSTED.md)** | 1 Supabase banyak PT, Supabase Free vs Pro, **langkah tenant ke-2**, RLS, deploy |
| **[KARYAWAN_TIDAK_TETAP.md](KARYAWAN_TIDAK_TETAP.md)** | NIK K vs NT, pegawai tetap / tidak tetap |
| **[README-FORK.md](README-FORK.md)** | Repo upstream + fork per perusahaan, sync versi, env per deploy |
| **[ONBOARDING_KLIEN_PT.md](ONBOARDING_KLIEN_PT.md)** | Checklist onboarding klien (Cloudflare, DNS, Resend, SQL) |
| **[KUOTA_LISENSI_PENJUAL.md](KUOTA_LISENSI_PENJUAL.md)** | `max_employees`, API `license-set`, trigger vendor |

## Deploy & infrastruktur

| Dokumen | Isi |
|---------|-----|
| **[DEPLOY_GITHUB_CLOUDFLARE.md](DEPLOY_GITHUB_CLOUDFLARE.md)** | Git push, root directory, Functions `/api/` |
| **[CLOUDFLARE_FUNCTIONS.md](CLOUDFLARE_FUNCTIONS.md)** | Environment variables Functions |
| **[REPO_PUBLIK_DAN_CONFIG.md](REPO_PUBLIK_DAN_CONFIG.md)** | `config.js`, env `SIGAJI_*` |
| **[CLOUDFLARE_FILE_TIDAK_TERUPDATE.md](CLOUDFLARE_FILE_TIDAK_TERUPDATE.md)** | Cache / file lama di production |
| **[DOMAIN_CEMERLANG_ONLINE.md](DOMAIN_CEMERLANG_ONLINE.md)** | Custom domain contoh |
| **[DNS_CEMERLANG_CLOUDFLARE.md](DNS_CEMERLANG_CLOUDFLARE.md)** | DNS Hostinger + Pages |

## Mobile (Android)

| Dokumen | Isi |
|---------|-----|
| **[MOBILE_ATTENDANCE_APP.md](MOBILE_ATTENDANCE_APP.md)** | Check-in foto+GPS multi-lokasi, cuti/sakit, keputusan HRD |
| **[ANDROID_APP_GUIDE.md](ANDROID_APP_GUIDE.md)** | PWA `/mobile/` di HP + rencana APK native |

## Email & integrasi

| Dokumen | Isi |
|---------|-----|
| **[SLIP_EMAIL_SMTP.md](SLIP_EMAIL_SMTP.md)** | Resend (disarankan di Cloudflare), SMTP |
| **Telegram** | SQL: `sql/supabase_sigaji_telegram.sql` |

## SQL & migrasi data

| Dokumen | Isi |
|---------|-----|
| **[../sql/README.md](../sql/README.md)** | Urutan jalankan skrip SQL |
| **[../sql/README_MIGRASI_TABEL.md](../sql/README_MIGRASI_TABEL.md)** | Mode `dual` / tabel v11 |

## Skrip & backup

| Dokumen | Isi |
|---------|-----|
| **[../scripts/DEPLOY_BACKUP_CLOUD.md](../scripts/DEPLOY_BACKUP_CLOUD.md)** | Backup cloud API |
| **[../scripts/BACKUP_BULANAN.md](../scripts/BACKUP_BULANAN.md)** | pg_dump bulanan |

## Kode modul

| Dokumen | Isi |
|---------|-----|
| **[../js/modules/README.md](../js/modules/README.md)** | Urutan load `app-*.js` |
