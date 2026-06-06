-- Multi-cabang per tenant — HANYA penjual via Supabase SQL Editor (service_role).
-- Admin/HRD buyer tidak bisa mengaktifkan dari aplikasi (trigger vendor_only).
-- Jalankan sekali, lalu: sql/supabase_tenant_license_vendor_only.sql

alter table public.sigaji_tenant_meta
  add column if not exists multi_branch_enabled boolean default false,
  add column if not exists max_branches int default 1;

comment on column public.sigaji_tenant_meta.multi_branch_enabled is 'Fitur multi-cabang — set hanya lewat SQL Editor penjual.';
comment on column public.sigaji_tenant_meta.max_branches is 'Maks cabang yang boleh dibuat Admin PT di Master → Cabang.';

-- Contoh aktifkan untuk satu PT (ganti tenant_key):
-- update public.sigaji_tenant_meta
-- set multi_branch_enabled = true, max_branches = 5, updated_at = now()
-- where tenant_key = 'main';
--
-- Nonaktifkan:
-- update public.sigaji_tenant_meta
-- set multi_branch_enabled = false, max_branches = 1, updated_at = now()
-- where tenant_key = 'main';
