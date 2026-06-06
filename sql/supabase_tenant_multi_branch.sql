-- Multi-cabang per tenant — hanya creator/penjual yang boleh mengaktifkan.
-- Jalankan sekali di Supabase → SQL Editor.
-- Lalu jalankan ulang: sql/supabase_tenant_license_vendor_only.sql (versi terbaru di repo).

alter table public.sigaji_tenant_meta
  add column if not exists multi_branch_enabled boolean default false,
  add column if not exists max_branches int default 1;

comment on column public.sigaji_tenant_meta.multi_branch_enabled is 'Fitur multi-cabang — hanya diubah creator/penjual (bukan Admin PT).';
comment on column public.sigaji_tenant_meta.max_branches is 'Maks jumlah cabang yang boleh dibuat Admin PT.';

-- Contoh aktifkan manual (SQL Editor / service_role):
-- update public.sigaji_tenant_meta
-- set multi_branch_enabled = true, max_branches = 5
-- where tenant_key = 'main';
