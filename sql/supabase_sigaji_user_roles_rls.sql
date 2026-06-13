-- =============================================================================
-- SiGaji — role di database (RLS) + pembatasan Karyawan
-- Jalankan SETELAH: supabase_migrate_to_shared_payload.sql, sigaji_tables_v11.sql,
-- supabase_data_api_grants.sql
--
-- Ganti 'main' jika SIGAJI_TENANT_KEY beda (sama seperti supabase_tenant_add.sql).
-- Setelah run: Admin buka app → simpan ulang Manajemen User (sinkron auth_uid),
-- atau jalankan blok BACKFILL di bawah.
-- =============================================================================

-- ── 1) Tabel mapping auth → role SiGaji ─────────────────────────────────────
create table if not exists public.sigaji_user_roles (
  tenant_key text not null default 'main',
  auth_uid uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('Admin', 'HRD', 'Karyawan', 'Absen')),
  nik text,
  email text,
  username text,
  aktif boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, auth_uid)
);

create index if not exists sigaji_user_roles_tenant_email_idx
  on public.sigaji_user_roles (tenant_key, lower(email));

alter table public.sigaji_user_roles enable row level security;

-- ── 2) Helper (security definer — baca mapping tanpa expose ke user lain) ───
create or replace function public.sigaji_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.role
  from public.sigaji_user_roles r
  where r.auth_uid = auth.uid()
    and r.aktif = true
  order by r.updated_at desc
  limit 1;
$$;

create or replace function public.sigaji_my_nik()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(r.nik), '')
  from public.sigaji_user_roles r
  where r.auth_uid = auth.uid()
    and r.aktif = true
  order by r.updated_at desc
  limit 1;
$$;

create or replace function public.sigaji_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.sigaji_my_role() in ('Admin', 'HRD'), false);
$$;

grant execute on function public.sigaji_my_role() to authenticated;
grant execute on function public.sigaji_my_nik() to authenticated;
grant execute on function public.sigaji_is_staff() to authenticated;

-- ── 3) RLS sigaji_user_roles ────────────────────────────────────────────────
drop policy if exists "sigaji_user_roles_select_own" on public.sigaji_user_roles;
drop policy if exists "sigaji_user_roles_staff_all" on public.sigaji_user_roles;

create policy "sigaji_user_roles_select_own"
  on public.sigaji_user_roles for select to authenticated
  using (auth_uid = auth.uid());

create policy "sigaji_user_roles_staff_all"
  on public.sigaji_user_roles for all to authenticated
  using (public.sigaji_is_staff() and tenant_key = 'main')
  with check (public.sigaji_is_staff() and tenant_key = 'main');

grant select, insert, update, delete on table public.sigaji_user_roles to authenticated;

-- ── 4) sigaji_cloud — hanya Admin/HRD (Karyawan tidak baca blob penuh) ───
drop policy if exists "sigaji_shared_select" on public.sigaji_cloud;
drop policy if exists "sigaji_shared_insert" on public.sigaji_cloud;
drop policy if exists "sigaji_shared_update" on public.sigaji_cloud;
drop policy if exists "sigaji_shared_delete" on public.sigaji_cloud;

create policy "sigaji_cloud_staff_select"
  on public.sigaji_cloud for select to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_cloud_staff_write"
  on public.sigaji_cloud for insert to authenticated
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_cloud_staff_update"
  on public.sigaji_cloud for update to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff())
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_cloud_staff_delete"
  on public.sigaji_cloud for delete to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff());

-- ── 5) sigaji_karyawan — Karyawan hanya baris NIK sendiri ───────────────────
drop policy if exists "sigaji_karyawan_main" on public.sigaji_karyawan;

create policy "sigaji_karyawan_staff_all"
  on public.sigaji_karyawan for all to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff())
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_karyawan_self_select"
  on public.sigaji_karyawan for select to authenticated
  using (
    tenant_key = 'main'
    and public.sigaji_my_nik() is not null
    and nik = public.sigaji_my_nik()
  );

-- ── 6) sigaji_store — Karyawan: store non-payroll saja ─────────────────────
drop policy if exists "sigaji_store_main" on public.sigaji_store;

create policy "sigaji_store_staff_all"
  on public.sigaji_store for all to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff())
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_store_karyawan_read"
  on public.sigaji_store for select to authenticated
  using (
    tenant_key = 'main'
    and store_key in ('perusahaan', 'masterCuti', 'hariLibur', 'notifikasi', 'roles', 'absensi')
  );

-- ── 7) sigaji_periode — semua login boleh baca (untuk slip); tulis staff ───
drop policy if exists "sigaji_periode_main" on public.sigaji_periode;

create policy "sigaji_periode_select_tenant"
  on public.sigaji_periode for select to authenticated
  using (tenant_key = 'main');

create policy "sigaji_periode_staff_write"
  on public.sigaji_periode for insert to authenticated
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_periode_staff_update"
  on public.sigaji_periode for update to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff())
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_periode_staff_delete"
  on public.sigaji_periode for delete to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff());

-- ── 8) Tunjangan variabel — Karyawan hanya NIK sendiri ─────────────────────
drop policy if exists "sigaji_tunj_var_kolom_main" on public.sigaji_tunj_var_kolom;
drop policy if exists "sigaji_tunj_var_nilai_main" on public.sigaji_tunj_var_nilai;

create policy "sigaji_tunj_kolom_select"
  on public.sigaji_tunj_var_kolom for select to authenticated
  using (tenant_key = 'main');

create policy "sigaji_tunj_kolom_staff_write"
  on public.sigaji_tunj_var_kolom for all to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff())
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_tunj_nilai_staff_all"
  on public.sigaji_tunj_var_nilai for all to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff())
  with check (tenant_key = 'main' and public.sigaji_is_staff());

create policy "sigaji_tunj_nilai_self_select"
  on public.sigaji_tunj_var_nilai for select to authenticated
  using (
    tenant_key = 'main'
    and public.sigaji_my_nik() is not null
    and nik = public.sigaji_my_nik()
  );

-- ── 9) tenant_meta — baca semua; tulis staff (kuota vendor lewat service_role) ─
drop policy if exists "sigaji_tenant_meta_main" on public.sigaji_tenant_meta;

create policy "sigaji_tenant_meta_select"
  on public.sigaji_tenant_meta for select to authenticated
  using (tenant_key = 'main');

create policy "sigaji_tenant_meta_staff_write"
  on public.sigaji_tenant_meta for all to authenticated
  using (tenant_key = 'main' and public.sigaji_is_staff())
  with check (tenant_key = 'main' and public.sigaji_is_staff());

-- =============================================================================
-- BACKFILL — wajib sekali agar Admin/HRD tidak terkunci setelah RLS ketat
-- =============================================================================
insert into public.sigaji_user_roles (tenant_key, auth_uid, role, nik, email, username, aktif)
select
  'main',
  (elem->>'auth_uid')::uuid,
  coalesce(nullif(trim(elem->>'role'), ''), 'Karyawan'),
  nullif(trim(elem->>'nik'), ''),
  lower(nullif(trim(elem->>'email'), '')),
  nullif(trim(elem->>'username'), ''),
  coalesce((elem->>'aktif')::boolean, true)
from public.sigaji_store s,
     jsonb_array_elements(s.data) elem
where s.tenant_key = 'main'
  and s.store_key = 'users'
  and nullif(trim(elem->>'auth_uid'), '') is not null
on conflict (tenant_key, auth_uid) do update set
  role = excluded.role,
  nik = excluded.nik,
  email = excluded.email,
  username = excluded.username,
  aktif = excluded.aktif,
  updated_at = now();
