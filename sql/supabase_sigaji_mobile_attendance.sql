-- =============================================================================
-- SiGaji Mobile — lokasi kerja, penugasan HRD, check-in/out, pengajuan cuti
-- Jalankan SEKALI di Supabase SQL Editor (setelah migrate tenant / v11).
-- Lalu: sql/supabase_data_api_grants.sql (bagian mobile, atau file grants terbaru)
-- Tenant tambahan: tambah policy di supabase_tenant_add.sql (bagian mobile)
-- Spesifikasi: docs/MOBILE_ATTENDANCE_APP.md
-- =============================================================================

-- ── Lokasi kerja (banyak titik: kantor, site, mess luar kota, dll.) ─────────
create table if not exists public.sigaji_work_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null default 'main',
  code text,
  nama text not null,
  lat double precision not null,
  lon double precision not null,
  radius_m int not null default 200 check (radius_m >= 50 and radius_m <= 5000),
  tipe text not null default 'site'
    check (tipe in ('kantor', 'site', 'dinas', 'mess', 'lainnya')),
  aktif boolean not null default true,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sigaji_work_locations_tenant_idx
  on public.sigaji_work_locations (tenant_key, aktif);

-- ── Penugasan lokasi per karyawan (HRD) — Senin–Sabtu bisa kerja di site luar ─
create table if not exists public.sigaji_location_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null default 'main',
  nik text not null,
  location_id uuid not null references public.sigaji_work_locations (id) on delete restrict,
  date_from date not null,
  date_to date not null,
  works_saturday boolean not null default true,
  catatan text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create index if not exists sigaji_location_assignments_lookup_idx
  on public.sigaji_location_assignments (tenant_key, nik, date_from, date_to);

create index if not exists sigaji_location_assignments_loc_idx
  on public.sigaji_location_assignments (tenant_key, location_id);

-- ── Enrollment wajah (sekali per NIK — vektor, bukan foto) ───────────────────
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

-- ── Log check-in / check-out (validasi wajah + GPS) — check-out WAJIB ───────
create table if not exists public.sigaji_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null default 'main',
  nik text not null,
  work_date date not null,
  event_type text not null check (event_type in ('check_in', 'check_out')),
  location_id uuid references public.sigaji_work_locations (id) on delete set null,
  lat double precision not null,
  lon double precision not null,
  accuracy_m double precision,
  photo_path text default '',
  face_verified boolean not null default false,
  face_score double precision,
  device_id text,
  is_mock boolean not null default false,
  validation_status text not null default 'ok'
    check (validation_status in ('ok', 'pending_review', 'rejected', 'outside_geofence')),
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_key, nik, work_date, event_type)
);

create index if not exists sigaji_attendance_logs_tenant_date_idx
  on public.sigaji_attendance_logs (tenant_key, work_date desc);

create index if not exists sigaji_attendance_logs_nik_idx
  on public.sigaji_attendance_logs (tenant_key, nik, work_date desc);

-- ── Pengajuan cuti / izin / sakit (template + lampiran) ─────────────────────
create table if not exists public.sigaji_leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null default 'main',
  nik text not null,
  request_type text not null
    check (request_type in ('cuti', 'izin', 'sakit')),
  date_from date not null,
  date_to date not null,
  reason text,
  attachment_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reject_note text,
  decided_at timestamptz,
  decided_by uuid,
  decided_by_name text,
  absensi_status text not null default 'cuti'
    check (absensi_status in ('cuti', 'izin', 'sakit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from),
  -- Sakit: surat dokter wajib sejak hari pertama pengajuan
  check (
    request_type <> 'sakit'
    or (attachment_path is not null and length(trim(attachment_path)) > 0)
  )
);

create index if not exists sigaji_leave_requests_tenant_status_idx
  on public.sigaji_leave_requests (tenant_key, status, created_at desc);

create index if not exists sigaji_leave_requests_nik_idx
  on public.sigaji_leave_requests (tenant_key, nik, created_at desc);

-- Default absensi_status mengikuti jenis
create or replace function public.sigaji_leave_requests_set_absensi_status()
returns trigger language plpgsql as $$
begin
  if new.absensi_status is null or new.absensi_status = 'cuti' then
    new.absensi_status := case new.request_type
      when 'izin' then 'izin'
      when 'sakit' then 'sakit'
      else 'cuti'
    end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sigaji_leave_requests_absensi on public.sigaji_leave_requests;
create trigger trg_sigaji_leave_requests_absensi
  before insert or update on public.sigaji_leave_requests
  for each row execute function public.sigaji_leave_requests_set_absensi_status();

-- ── RLS tenant main (sama pola sigaji_cloud) ────────────────────────────────
alter table public.sigaji_work_locations enable row level security;
alter table public.sigaji_location_assignments enable row level security;
alter table public.sigaji_attendance_logs enable row level security;
alter table public.sigaji_face_enrollments enable row level security;
alter table public.sigaji_leave_requests enable row level security;

drop policy if exists "sigaji_work_locations_main" on public.sigaji_work_locations;
create policy "sigaji_work_locations_main" on public.sigaji_work_locations for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_location_assignments_main" on public.sigaji_location_assignments;
create policy "sigaji_location_assignments_main" on public.sigaji_location_assignments for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_attendance_logs_main" on public.sigaji_attendance_logs;
create policy "sigaji_attendance_logs_main" on public.sigaji_attendance_logs for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_face_enrollments_main" on public.sigaji_face_enrollments;
create policy "sigaji_face_enrollments_main" on public.sigaji_face_enrollments for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_leave_requests_main" on public.sigaji_leave_requests;
create policy "sigaji_leave_requests_main" on public.sigaji_leave_requests for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

-- Catatan: pembatasan role HRD vs Karyawan di-enforce di API / app (bukan RLS),
-- karena role SiGaji disimpan di payload users, bukan JWT claim.

-- ── Storage (jalankan manual di Dashboard jika belum ada) ─────────────────────
-- Bucket: sigaji-mobile (private)
-- Path lampiran cuti: {tenant_key}/leave/{nik}/{uuid}.pdf|.jpg
-- Absensi: tidak simpan foto (validasi wajah on-device); enrollment simpan vektor di sigaji_face_enrollments
-- Path surat: {tenant_key}/leave/{nik}/{uuid}.pdf|.jpg
-- Policy storage: authenticated upload/read own tenant — atur di Dashboard atau SQL storage policies.
--
-- Notifikasi karyawan (disetujui/ditolak pengajuan): sql/supabase_mobile_notifications.sql
