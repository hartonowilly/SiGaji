# Multi-tenant hosted — 1 Supabase, banyak klien PT

Panduan untuk **penjual SiGaji**: satu proyek Supabase, banyak `tenant_key`, kuota per PT di `sigaji_tenant_meta`.

Fork repo per perusahaan (kebijakan UI beda): **[README-FORK.md](README-FORK.md)**.

---

## Arsitektur (yang Anda pakai)

```text
                    ┌─────────────────────────────────────┐
                    │     1× Supabase (hosted)            │
                    │  main │ pt_maju │ pt_xyz │ ...      │
                    │  sigaji_tenant_meta (kuota)         │
                    └─────────────────────────────────────┘
                           ▲              ▲
           SIGAJI_TENANT_KEY=main        SIGAJI_TENANT_KEY=pt_maju
                           │              │
              ┌────────────┴──┐    ┌──────┴────────────┐
              │ Cloudflare     │    │ Cloudflare         │
              │ cemerlang.online│    │ gaji.ptmaju.co.id │
              │ (repo A)       │    │ (repo B / fork)   │
              └────────────────┘    └───────────────────┘
```

| Komponen | Jumlah | Catatan |
|----------|--------|---------|
| Supabase | **1** (hosted) | Semua PT; pantau ukuran DB & egress |
| Repo upstream | **1** (`sigaji-app`) | Bugfix & fitur inti |
| Repo deploy | **1 per PT** (opsional) | Kebijakan/branding beda |
| Cloudflare Pages | **1 per URL klien** | Env: Supabase **sama**, `SIGAJI_TENANT_KEY` **beda** |
| `tenant_key` | **1 per PT** | Huruf kecil, underscore, tanpa spasi |

**Bukan multi-tenant:** karyawan **tetap** vs **tidak tetap** = satu `tenant_key`, beda komponen gaji di Master Karyawan.

**Belum ada di app:** satu URL + dropdown “pilih perusahaan” saat login. Tenant = env saat **build/deploy**.

---

## Apakah Supabase Free cukup?

| Kuota Free | Nilai | SiGaji hosted |
|------------|-------|----------------|
| Database | ~500 MB / proyek | Banyak PT kecil biasanya OK; pantau Dashboard |
| MAU Auth | 50.000 / bulan | **Semua PT dijumlah** (user yang login) |
| Egress | 5 GB / bulan | Sync awan — bisa ketat jika banyak refresh |
| Pause | Setelah ~1 minggu tidak aktif | **Berbahaya produksi** → naik **Pro (~$25/bln)** |
| Proyek aktif | Maks 2 Free / org | 1 prod hosted + 1 dev |

**Rekomendasi:** pilot di Free; **produksi jualan** → **Pro** pada proyek Supabase yang sama.

Detail resmi: [Supabase Pricing](https://supabase.com/pricing).

---

## Prasyarat (tenant pertama = `main`)

Sudah jalan di Supabase Anda:

1. `sql/supabase_sigaji_cloud.sql`
2. `sql/supabase_migrate_to_shared_payload.sql`
3. `sql/supabase_sigaji_tables_v11.sql`
4. `sql/supabase_data_api_grants.sql`
5. `sql/supabase_tenant_license.sql` + `sql/supabase_tenant_license_vendor_only.sql`
6. Kuota `main`: `sql/supabase_tenant_license_set_vendor.sql`
7. (Opsional) `sql/supabase_login_branding_rpc_tenant.sql` — branding login per tenant
8. (Opsional) registrasi, Telegram, slip: file di `sql/README.md`

---

## Langkah menambah tenant ke-2, ke-3, …

Ganti contoh `pt_majubersama` dengan key Anda (mis. `pt_xyz`).

### Langkah 1 — Tentukan identitas

| Field | Contoh |
|-------|--------|
| Nama PT | PT Maju Bersama |
| `tenant_key` | `pt_majubersama` |
| Kuota karyawan | `30` |
| Paket | `Basic` |
| URL deploy | `https://gaji.ptmajubersama.co.id` |

Aturan `tenant_key`: `a-z`, `0-9`, `_` — tanpa spasi.

### Langkah 2 — Supabase SQL Editor

1. Buka `sql/supabase_tenant_add.sql`.
2. **Find & Replace** semua `__TENANT_KEY__` → `pt_majubersama`.
3. Sesuaikan angka kuota di bagian `INSERT sigaji_tenant_meta` jika perlu.
4. **Run** seluruh skrip.
5. Verifikasi:

```sql
select tenant_key, max_employees, plan_label
from public.sigaji_tenant_meta
order by tenant_key;

select tenant_key, count(*), max(updated_at)
from public.sigaji_cloud
group by tenant_key;
```

Harus muncul baris tenant baru; `sigaji_cloud` boleh 0 atau 1 baris payload `{}`.

### Langkah 3 — Branding login (sekali global, jika belum)

Jalankan **`sql/supabase_login_branding_rpc_tenant.sql`** (agar RPC tidak selalu baca `main`).

Tanpa ini, branding login tenant-2 tetap bisa dari `sigaji_store` setelah RLS tenant ada (app fallback).

### Langkah 4 — Supabase Auth

**Authentication → URL Configuration → Redirect URLs** — tambahkan:

```text
https://gaji.ptmajubersama.co.id/
https://gaji.ptmajubersama.co.id/**
```

(Sama untuk invite/reset password.)

### Langkah 5 — Cloudflare Pages (deploy PT baru)

**Duplicate project** (atau repo fork baru — lihat README-FORK).

Environment **Production** (Supabase **sama** dengan Cemerlang):

```env
SIGAJI_SUPABASE_URL=https://xxxx.supabase.co
SIGAJI_SUPABASE_ANON_KEY=eyJ...
SIGAJI_SUPABASE_SERVICE_ROLE_KEY=eyJ...
SIGAJI_SITE_URL=https://gaji.ptmajubersama.co.id/

# WAJIB beda dari deploy main:
SIGAJI_TENANT_KEY=pt_majubersama

SIGAJI_STORAGE_MODE=dual
SIGAJI_EMAIL_PROVIDER=resend
SIGAJI_RESEND_API_KEY=re_...
SIGAJI_RESEND_FROM=SiGaji <noreply@send.domain-pt.com>

# Opsional — kunci di browser (tetap set juga di sigaji_tenant_meta):
# SIGAJI_MAX_EMPLOYEES=30

SIGAJI_LICENSE_ADMIN_SECRET=...   # untuk API license-set
```

| Setting | Nilai |
|---------|--------|
| Build command | `npm install && npm run build` |
| Root directory | kosong jika `index.html` di root repo |

Deploy → tes `https://domain-pt/api/health` → `{"ok":true,...}`.

### Langkah 6 — DNS

CNAME domain PT → `nama-project.pages.dev` (sama pola seperti onboarding).

### Langkah 7 — Admin pertama PT baru

1. Buka URL PT (bukan URL Cemerlang).
2. **Daftar email** → login Admin Cemerlang **tidak** otomatis ada di tenant lain.
3. Di tenant `pt_majubersama`: User & Akses → **Permintaan registrasi** → Approve.
4. Atau buat user manual di Supabase Auth (email unik global).

### Langkah 8 — Kuota (alternatif SQL)

API (ganti secret & tenant):

```powershell
$body = '{"tenant_key":"pt_majubersama","maxEmployees":30,"planLabel":"Basic"}'
Invoke-RestMethod -Method POST `
  -Uri "https://DOMAIN-PT/api/license-set" `
  -Headers @{ Authorization = "Bearer RAHASIA_LICENSE" } `
  -ContentType "application/json" `
  -Body $body
```

### Langkah 9 — Uji

- [ ] Login awan di URL PT (bukan `main` kecuali deploy main).
- [ ] Master karyawan + hitung gaji + sinkron.
- [ ] Badge kuota: `Basic · 0 / 30` (naik setelah ada karyawan).
- [ ] Console: `sigajiGetEffectiveMaxEmployees()` > 0.
- [ ] User `main` **tidak** melihat data `pt_majubersama` di app (URL/env berbeda).

---

## Keamanan (1 Supabase, banyak tenant)

RLS menambah policy per tenant (OR). User Auth yang sama **secara teori** bisa query tenant lain lewat API jika tahu `tenant_key` — mitigasi praktis:

- Email login **per PT** / tidak berbagi akun antar klien.
- Untuk klien enterprise: Supabase **terpisah** (model dedicated di ONBOARDING).

---

## Kapan Supabase / deploy terpisah?

| Situasi | Tindakan |
|---------|----------|
| Banyak PT kecil, Anda pegang kuota | Tetap **1 Supabase** + tenant_key |
| DB > ~400 MB | Pro atau kurangi blob / PT dedicated DB |
| Audit / kontrak isolasi penuh | Supabase baru, `tenant_key=main` |

---

## Troubleshooting

| Gejala | Penyebab | Perbaikan |
|--------|----------|-----------|
| Login OK, data kosong / error RLS | Policy tenant belum ada | Jalankan `supabase_tenant_add.sql` |
| Kuota tidak muncul | `sigaji_tenant_meta` kosong | Insert / license-set |
| Registrasi email gagal | Policy anon hanya `main` | Bagian registrasi di `supabase_tenant_add.sql` |
| Branding salah PT | RPC lama | `supabase_login_branding_rpc_tenant.sql` |
| Semua PT dapat data sama | `SIGAJI_TENANT_KEY` salah di Cloudflare | Perbaiki env + redeploy |

---

## File terkait

- `sql/supabase_tenant_add.sql` — skrip tambah tenant
- `docs/KUOTA_LISENSI_PENJUAL.md`
- `docs/ONBOARDING_KLIEN_PT.md`
- `docs/README-FORK.md`
