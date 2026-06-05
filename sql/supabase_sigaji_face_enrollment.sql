-- =============================================================================
-- SiGaji Mobile — enrollment wajah (sekali per karyawan) + absensi tanpa foto
-- Jalankan SETELAH supabase_sigaji_mobile_attendance.sql
-- Spesifikasi: docs/MOBILE_ATTENDANCE_APP.md
-- =============================================================================

-- Template wajah: vektor embedding (bukan foto). Dihitung di HP saat enrollment.
create table if not exists public.sigaji_face_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null default 'main',
  nik text not null,
  embedding jsonb not null,
  model_version text not null default 'landmark_v1',
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_key, nik)
);

create index if not exists sigaji_face_enrollments_tenant_idx
  on public.sigaji_face_enrollments (tenant_key, nik);

-- Log absensi: foto tidak wajib; validasi wajah on-device
alter table public.sigaji_attendance_logs
  alter column photo_path drop not null;

alter table public.sigaji_attendance_logs
  alter column photo_path set default '';

update public.sigaji_attendance_logs
  set photo_path = ''
  where photo_path is null;

alter table public.sigaji_attendance_logs
  add column if not exists face_verified boolean not null default false;

alter table public.sigaji_attendance_logs
  add column if not exists face_score double precision;

alter table public.sigaji_face_enrollments enable row level security;

drop policy if exists "sigaji_face_enrollments_main" on public.sigaji_face_enrollments;
create policy "sigaji_face_enrollments_main" on public.sigaji_face_enrollments for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

grant select, insert, update, delete on table public.sigaji_face_enrollments to authenticated;
grant select, insert, update, delete on table public.sigaji_face_enrollments to service_role;
