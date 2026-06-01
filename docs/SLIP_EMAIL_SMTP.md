# Kirim slip gaji massal lewat email

SiGaji mengirim PDF slip dari **server Cloudflare Pages** (`/api/slip-email-send`), bukan `mailto:` di laptop. Email dikirim lewat SMTP Hostinger, misalnya `admin@cemerlang.online`.

## 1. Cloudflare Pages — environment variables

**Workers & Pages → proyek → Settings → Environment variables** (Production):

| Variable | Contoh |
|----------|--------|
| `SIGAJI_SMTP_HOST` | `smtp.hostinger.com` |
| `SIGAJI_SMTP_PORT` | `587` (disarankan) atau `465` |
| `SIGAJI_SMTP_SECURE` | kosong/auto, atau `false` untuk port 587, `true` untuk 465 |
| `SIGAJI_SMTP_USER` | `admin@cemerlang.online` |
| `SIGAJI_SMTP_PASS` | password mailbox Hostinger |
| `SIGAJI_SMTP_FROM` | `SiGaji HR <admin@cemerlang.online>` (opsional) |

Tetap wajib (sudah ada): `SIGAJI_SUPABASE_URL`, `SIGAJI_SUPABASE_SERVICE_ROLE_KEY`.

Deploy ulang setelah menambah env.

**Catatan Cloudflare:** `nodemailer` **tidak jalan** di Workers. SiGaji memakai **`@ryyr/worker-mailer@^0.2.0`** (SMTP lewat TCP). Pastikan build command **`npm install && npm run build`** sukses — jika `package.json` meminta versi yang tidak ada di npm, deploy gagal install dan `/api/slip-email-send` HTTP 500.

### Jika port 587 gagal (HTTP 500)

Coba di Cloudflare env:

| Variable | Nilai |
|----------|--------|
| `SIGAJI_SMTP_PORT` | `465` |
| `SIGAJI_SMTP_SECURE` | `true` |

### Alternatif: Resend (HTTP, tanpa SMTP)

| Variable | Nilai |
|----------|--------|
| `SIGAJI_EMAIL_PROVIDER` | `resend` |
| `SIGAJI_RESEND_API_KEY` | API key dari resend.com |
| `SIGAJI_RESEND_FROM` | `SiGaji <noreply@cemerlang.online>` (domain harus diverifikasi di Resend) |

## 2. Supabase — tabel riwayat (opsional tapi disarankan)

Jalankan `sql/supabase_sigaji_slip_email_sent.sql`, lalu baris grant di `sql/supabase_data_api_grants.sql` (bagian `sigaji_slip_email_sent`).

## 3. Di aplikasi

Menu **Slip Gaji** → tabel **Kirim slip ke banyak karyawan** (urut NIK) → centang → **Kirim email terpilih** (email harus terisi di profil).

Periode ber-THR + jenis slip **Gaji bulanan**: bisa mengirim slip gaji lalu slip THR (dua email) jika eligible.

## 4. Batas Hostinger

Mailbox shared hosting biasanya membatasi jumlah email per jam/hari. Kirim berurutan (~0,6 detik/orang). Untuk ratusan karyawan, pertimbangkan batch per bagian.

## 5. Uji satu orang

Centang satu karyawan yang emailnya benar → kirim → cek inbox & folder spam.
