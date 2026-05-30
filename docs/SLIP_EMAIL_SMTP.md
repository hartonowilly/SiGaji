# Kirim slip gaji massal lewat email

SiGaji mengirim PDF slip dari **server Netlify** (bukan `mailto:` di laptop). Email dikirim lewat SMTP Hostinger, misalnya `admin@cemerlang.online`.

## 1. Netlify — environment variables

Site settings → Environment variables:

| Variable | Contoh |
|----------|--------|
| `SIGAJI_SMTP_HOST` | `smtp.hostinger.com` |
| `SIGAJI_SMTP_PORT` | `465` (SSL) atau `587` (TLS) |
| `SIGAJI_SMTP_USER` | `admin@cemerlang.online` |
| `SIGAJI_SMTP_PASS` | password mailbox Hostinger |
| `SIGAJI_SMTP_FROM` | `SiGaji HR <admin@cemerlang.online>` (opsional) |

Tetap wajib (sudah ada): `SIGAJI_SUPABASE_URL`, `SIGAJI_SUPABASE_SERVICE_ROLE_KEY`.

Deploy ulang setelah menambah env.

## 2. Supabase — tabel riwayat (opsional tapi disarankan)

Jalankan `sql/supabase_sigaji_slip_email_sent.sql`, lalu baris grant di `sql/supabase_data_api_grants.sql` (bagian `sigaji_slip_email_sent`).

## 3. Di aplikasi

Menu **Slip Gaji** → bagian **Kirim slip ke email** → centang karyawan (email harus terisi di profil) → **Kirim email terpilih**.

Periode ber-THR + jenis slip **Gaji bulanan**: bisa mengirim slip gaji lalu slip THR (dua email) jika eligible.

## 4. Batas Hostinger

Mailbox shared hosting biasanya membatasi jumlah email per jam/hari. Kirim berurutan (~0,6 detik/orang). Untuk ratusan karyawan, pertimbangkan batch per bagian.

## 5. Uji satu orang

Centang satu karyawan yang emailnya benar → kirim → cek inbox & folder spam.
