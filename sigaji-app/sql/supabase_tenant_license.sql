-- Kuota lisensi per tenant (paket Basic 20 orang, dll.)
-- Jalankan sekali di Supabase → SQL Editor.

alter table public.sigaji_tenant_meta
  add column if not exists max_employees int,
  add column if not exists plan_label text;

comment on column public.sigaji_tenant_meta.max_employees is 'Maks karyawan aktif (tanpa tgl_berhenti). NULL atau 0 = tidak dibatasi.';
comment on column public.sigaji_tenant_meta.plan_label is 'Nama paket tampilan, mis. Basic, Standard.';

-- Wajib juga jalankan: sql/supabase_tenant_license_vendor_only.sql
-- (Admin perusahaan tidak bisa mengubah kolom ini lewat aplikasi.)
