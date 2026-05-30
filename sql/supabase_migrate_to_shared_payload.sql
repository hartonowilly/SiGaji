-- =============================================================================
-- PENTING untuk tim (Admin + HRD + lainnya): satu database SiGaji untuk semua.
-- Tanpa ini, tiap email Supabase punya BARIS payload SENDIRI — HR tidak melihat
-- user & role yang Admin sunting di Table Editor / aplikasi.
--
-- Jalankan SEKALI di Supabase → SQL Editor setelah Anda sudah punya tabel
-- sigaji_cloud (versi lama per user_id).
-- BACKUP / export data dari Table Editor jika perlu sebelum migrate.
-- =============================================================================

alter table public.sigaji_cloud add column if not exists tenant_key text default 'main';

update public.sigaji_cloud set tenant_key = 'main' where tenant_key is null;

-- Buang duplikat tenant_key: sisakan baris dengan updated_at terbaru
delete from public.sigaji_cloud a
using public.sigaji_cloud b
where a.tenant_key = b.tenant_key
  and a.updated_at < b.updated_at;

alter table public.sigaji_cloud drop constraint if exists sigaji_cloud_user_id_fkey;

alter table public.sigaji_cloud alter column user_id drop not null;

create unique index if not exists sigaji_cloud_tenant_unique on public.sigaji_cloud (tenant_key);

drop policy if exists "sigaji_cloud_select_own" on public.sigaji_cloud;
drop policy if exists "sigaji_cloud_insert_own" on public.sigaji_cloud;
drop policy if exists "sigaji_cloud_update_own" on public.sigaji_cloud;
drop policy if exists "sigaji_cloud_delete_own" on public.sigaji_cloud;

-- Semua user yang sudah login Supabase Auth boleh baca/tulis payload utama
create policy "sigaji_shared_select"
  on public.sigaji_cloud for select
  to authenticated
  using (tenant_key = 'main');

create policy "sigaji_shared_insert"
  on public.sigaji_cloud for insert
  to authenticated
  with check (tenant_key = 'main');

create policy "sigaji_shared_update"
  on public.sigaji_cloud for update
  to authenticated
  using (tenant_key = 'main')
  with check (tenant_key = 'main');

create policy "sigaji_shared_delete"
  on public.sigaji_cloud for delete
  to authenticated
  using (tenant_key = 'main');
