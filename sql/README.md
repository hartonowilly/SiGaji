# SQL Supabase — urutan & tambah tenant

Panduan hosted multi-tenant: **[../docs/MULTI_TENANT_HOSTED.md](../docs/MULTI_TENANT_HOSTED.md)**.

---

## Setup awal (sekali per proyek Supabase)

Jalankan di **SQL Editor** berurutan:

| # | File | Keterangan |
|---|------|------------|
| 1 | `supabase_sigaji_cloud.sql` | Tabel blob awal |
| 2 | `supabase_migrate_to_shared_payload.sql` | `tenant_key` + policy shared (`main`) |
| 3 | `supabase_sigaji_tables_v11.sql` | Tabel normalisasi v11 |
| 4 | `supabase_data_api_grants.sql` | GRANT PostgREST |
| 5 | `supabase_tenant_license.sql` | Kolom kuota |
| 6 | `supabase_tenant_license_vendor_only.sql` | Trigger lindungi kuota |
| 7 | `supabase_tenant_license_set_vendor.sql` | Set kuota `main` (sesuaikan angka) |
| 8 | `supabase_login_branding_rpc_tenant.sql` | RPC branding per tenant (disarankan) |

### Opsional (sesuai fitur)

| File | Fitur |
|------|--------|
| `supabase_sigaji_registration.sql` | Permintaan daftar email |
| `supabase_registration_anon_insert.sql` | Insert daftar dari browser (anon) |
| `supabase_sigaji_telegram.sql` | Telegram |
| `supabase_sigaji_slip_email_sent.sql` | Riwayat email slip |
| `supabase_sigaji_slip_tg_sent.sql` | Riwayat Telegram slip |
| `supabase_fix_slip_tg_sent_period_nama.sql` | Perbaikan data lama |
| `supabase_sigaji_mobile_attendance.sql` | App Android: lokasi, check-in/out, pengajuan cuti |

Spesifikasi app mobile: **[../docs/MOBILE_ATTENDANCE_APP.md](../docs/MOBILE_ATTENDANCE_APP.md)**.

Migrasi mode tabel: **[README_MIGRASI_TABEL.md](README_MIGRASI_TABEL.md)**.

---

## Tenant pertama (`main`)

Sudah tercakup skrip di atas. Cemerlang / deploy utama: `SIGAJI_TENANT_KEY` kosong atau `main`.

---

## Tenant ke-2, ke-3, … (1 Supabase)

1. Edit **`supabase_tenant_add.sql`**: ganti semua **`__TENANT_KEY__`** → mis. `pt_majubersama`.
2. Sesuaikan `max_employees` / `plan_label` di `INSERT sigaji_tenant_meta`.
3. **Run** di SQL Editor.
4. Cloudflare deploy baru: `SIGAJI_TENANT_KEY=pt_majubersama` (URL Supabase sama).

Langkah lengkap: **[../docs/MULTI_TENANT_HOSTED.md](../docs/MULTI_TENANT_HOSTED.md)**.

---

## Set kuota tanpa Table Editor

`supabase_tenant_license_set_vendor.sql` — ganti `tenant_key` di file, atau API `POST /api/license-set`.

Lihat **[../docs/KUOTA_LISENSI_PENJUAL.md](../docs/KUOTA_LISENSI_PENJUAL.md)**.

---

## Verifikasi cepat

```sql
select tenant_key, max_employees, plan_label from public.sigaji_tenant_meta order by 1;
select tablename, policyname from pg_policies where policyname like '%__TENANT_KEY%' or policyname like '%main%';
```

(Ganti `__TENANT_KEY__` di query policy jika cek tenant tertentu.)
