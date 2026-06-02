# Onboarding klien PT — SiGaji (penjual / vendor)

Panduan standar agar setup klien baru **1–2 jam**, tanpa mengulang migrasi Netlify→Cloudflare penuh.

**Prinsip:** satu platform deploy (**Cloudflare Pages**), email slip (**Resend**), DNS web/email di **panel DNS klien** (Hostinger OK — Cloudflare DNS tidak wajib).

Lihat juga: **`MULTI_TENANT_HOSTED.md`** (1 Supabase, tenant ke-2), **`README-FORK.md`** (repo per PT), `KUOTA_LISENSI_PENJUAL.md`, `CLOUDFLARE_FUNCTIONS.md`, `SLIP_EMAIL_SMTP.md`, `REPO_PUBLIK_DAN_CONFIG.md`.

---

## Pilih model (sebelum mulai)

| Model | Cocok untuk | Setup | Domain klien |
|--------|-------------|--------|----------------|
| **A — Hosted multi-tenant** | Banyak PT kecil, Anda pegang infra | Cepat (~30–60 menit) | Opsional nanti |
| **B — Dedicated per PT** | PT besar, isolasi data ketat, domain sendiri | ~1–2 jam | `gaji.ptabc.co.id` → Pages |

**Jangan** tawarkan “klien bebas pilih Netlify atau Cloudflare dan migrasi sendiri” — dua jalur = support berlipat.

---

## Model A — Hosted (satu deploy, banyak PT)

### Yang Anda siapkan sekali

- [ ] Satu proyek **Cloudflare Pages** (repo `sigaji-app` di root, branch production konsisten, mis. `master`)
- [ ] Build: `npm install && npm run build`
- [ ] Env global (lihat tabel di bawah) + **Resend** untuk email slip
- [ ] Satu proyek **Supabase** (atau satu per region)

### Per klien PT baru

- [ ] Tentukan `tenant_key`, mis. `pt_majubersama` (huruf kecil, tanpa spasi)
- [ ] Supabase → `sigaji_tenant_meta` → insert/update:

  | Kolom | Contoh |
  |--------|--------|
  | `tenant_key` | `pt_majubersama` |
  | `max_employees` | `20` |
  | `plan_label` | `Basic` |

  SQL: `sql/supabase_tenant_license.sql` + `sql/supabase_tenant_license_vendor_only.sql`

- [ ] Saat build/deploy **dedicated URL** untuk PT itu: set env Cloudflare `SIGAJI_TENANT_KEY=pt_majubersama` **atau** beri klien subdomain terpisah (Model B) — untuk satu URL shared, semua klien pakai tenant yang sama di env (hanya cocok jika **satu PT per deploy**)

  **Catatan:** Satu URL + banyak tenant di browser butuh `SIGAJI_TENANT_KEY` per deploy atau fitur login per perusahaan (belum otomatis dari domain). Praktik aman: **satu tenant_key = satu deploy Pages** (lihat Model B) atau satu URL khusus per kontrak dengan env berbeda (duplicate project).

- [ ] Buat user Admin pertama (daftar di app → approve, atau Supabase Auth manual)
- [ ] Kirim ke klien: URL app, email login, panduan singkat

### URL untuk klien

Contoh: `https://payroll.vendoranda.com` (custom domain pada project Pages Anda).

---

## Model B — Dedicated per PT (disarankan untuk jualan white-label)

Satu PT = satu proyek Cloudflare Pages (duplicate dari template) + satu Supabase (disarankan terpisah).

### Checklist penjual (copy per klien)

**Identitas kontrak**

- [ ] Nama PT: _______________________
- [ ] `tenant_key`: `main` (biasanya cukup di Supabase dedicated)
- [ ] Kuota karyawan: ______ (`max_employees`)
- [ ] URL akhir: `https://_______________________/`

---

### 1. Supabase (15–20 menit)

- [ ] Buat proyek baru (region Singapore disarankan)
- [ ] **SQL Editor** — jalankan berurutan (sesuai kebutuhan fitur):
  - Skema cloud / tabel (`sql/supabase_sigaji_tables_v11.sql` jika pakai mode `dual`)
  - `sql/supabase_registration_anon_insert.sql` (daftar email dari browser)
  - `sql/supabase_tenant_license.sql` + `sql/supabase_tenant_license_vendor_only.sql`
  - Grant API: `sql/supabase_data_api_grants.sql`
  - Telegram / slip terkirah: file SQL terkait di folder `sql/`
- [ ] **Authentication → URL Configuration** → Redirect URLs:

  ```
  https://DOMAIN-KLIEN/
  https://DOMAIN-KLIEN/**
  ```

- [ ] **Authentication → SMTP** (opsional): Hostinger / custom untuk email undangan Auth — terpisah dari Resend slip gaji
- [ ] Catat: **Project URL**, **anon key**, **service_role key** (rahasia)

---

### 2. Cloudflare Pages (20–30 menit)

**Create project** → connect Git repo (root = `index.html` di root, **bukan** subfolder salah).

| Setting | Nilai |
|---------|--------|
| Production branch | `master` (sesuaikan repo) |
| Root directory | **kosong** jika `index.html` di root repo |
| Build command | `npm install && npm run build` |
| Build output | `.` (default Pages) |

**Environment variables (Production)** — paste dan isi:

```env
SIGAJI_SUPABASE_URL=https://xxxx.supabase.co
SIGAJI_SUPABASE_ANON_KEY=eyJ...
SIGAJI_SUPABASE_SERVICE_ROLE_KEY=eyJ...
SIGAJI_SITE_URL=https://www.domain-klien.co.id/
SIGAJI_TENANT_KEY=main

# Email slip — wajib di Cloudflare (bukan SMTP Hostinger langsung)
SIGAJI_EMAIL_PROVIDER=resend
SIGAJI_RESEND_API_KEY=re_...
SIGAJI_RESEND_FROM=SiGaji HR <noreply@send.domain-klien.co.id>

# Opsional
SIGAJI_TELEGRAM_BOT_TOKEN=
```

- [ ] Deploy → status **Success**
- [ ] Tes: `https://DOMAIN-KLIEN/api/health` → JSON `{"ok":true,"service":"sigaji-api"}` (bukan halaman login HTML)

Detail env: `CLOUDFLARE_FUNCTIONS.md`, email: `SLIP_EMAIL_SMTP.md`.

---

### 3. DNS klien (10–20 menit) — di Hostinger / mana pun NS domain berada

**Web (wajib jika pakai domain PT):**

| Type | Name | Target |
|------|------|--------|
| CNAME | `www` | `nama-project.pages.dev` |
| ALIAS/CNAME | `@` | `nama-project.pages.dev` (sesuai panduan Hostinger) |

**Email slip (Resend)** — tambah record dari dashboard Resend (subdomain `send` disarankan):

| Type | Name | Isi (contoh) |
|------|------|----------------|
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT/CNAME | `resend._domainkey` / CNAME DKIM | dari Resend |
| MX | `send` | dari Resend (jika diminta) |

**Email mailbox PT (terima surat):** biarkan MX Hostinger seperti semula — jangan dihapus.

Cloudflare **tidak perlu** menu DNS jika nameserver domain tetap di Hostinger.

---

### 4. Resend (10 menit)

- [ ] Domain / subdomain verified
- [ ] `SIGAJI_RESEND_FROM` sama dengan alamat yang diizinkan Resend
- [ ] Tes kirim satu slip dari app (login Admin/HRD)

---

### 5. Lisensi & Admin (10 menit)

- [ ] `sigaji_tenant_meta`: `max_employees`, `plan_label`
- [ ] Registrasi Admin: daftar di app → **User & Akses → Permintaan registrasi** → Approve
- [ ] Pastikan email login = email di Supabase Auth & baris `users` di cloud

Kuota: `KUOTA_LISENSI_PENJUAL.md`.

---

### 6. Uji akhir (15 menit)

- [ ] Login Admin/HRD
- [ ] Master periode + satu karyawan + hitung gaji
- [ ] Unduh slip PDF
- [ ] Kirim slip **email** (Resend) — Response `provider: "resend"`
- [ ] (Opsional) Telegram link + kirim slip
- [ ] (Opsional) Backup cloud / sinkron awan
- [ ] Laporan → PPh 21 → PDF 1721-A1 (arsip internal)

---

## Yang tidak dilakukan untuk klien baru

- Migrasi dari Netlify klien kecuali ada kontrak migrasi data terpisah
- SMTP `smtp.hostinger.com` langsung dari Cloudflare Workers (biasanya gagal — `proxy request failed`)
- Dua struktur repo (`sigaji-app/` nested vs root) tanpa diseragamkan
- Mengubah nameserver domain ke Cloudflare hanya untuk situs — tidak wajib

---

## Serah terima ke klien

Kirim dokumen singkat:

1. URL aplikasi + email Admin  
2. Cara tambah karyawan / periode / proses gaji  
3. Kontak support Anda  
4. Kebijakan backup (export cloud / Excel)  
5. Pajak: bukti potong resmi lewat **Coretax / e-Bupot**; PDF 1721-A1 di SiGaji = arsip acuan

---

## Estimasi waktu

| Model | Waktu |
|--------|--------|
| A — tenant + kuota (deploy sudah jalan) | 30–60 menit |
| B — dedicated + domain + Resend | 1–2 jam |
| Migrasi data Excel / gaji tahun lalu | +2–8 jam (kontrak terpisah) |

---

## Template nama proyek Cloudflare

Disarankan: `sigaji-pt-{singkatan}` agar tidak bercampur dengan produk demo Anda.

Contoh env file untuk arsip internal (jangan commit ke Git publik):

```
docs/ONBOARDING_KLIEN_PT.env.example.txt   ← buat jika perlu; atau salin blok env di atas
```

---

## Troubleshooting cepat

| Gejala | Cek |
|--------|-----|
| Login/daftar gagal | `js/config.js` ter-build? Env URL + anon di Cloudflare? |
| `/api/*` HTML bukan JSON | `functions/api/` + `wrangler.toml` ikut deploy; `404.html` ada |
| Email slip 500 | Resend verified? `SIGAJI_EMAIL_PROVIDER=resend`? Bukan SMTP di CF |
| File JS versi lama | Push branch production benar; hard refresh; lihat `CLOUDFLARE_FILE_TIDAK_TERUPDATE.md` |

---

*Terakhir diselaraskan dengan deploy Cloudflare Pages + Resend (bukan SMTP TCP Hostinger di Workers).*
