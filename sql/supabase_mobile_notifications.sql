-- SiGaji Mobile — notifikasi karyawan (pengajuan cuti/izin/sakit disetujui/ditolak, dll.)
-- Jalankan setelah supabase_sigaji_mobile_attendance.sql
-- Lalu: grant di supabase_data_api_grants.sql (bagian sigaji_mobile_notifications)

create table if not exists public.sigaji_mobile_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null default 'main',
  nik text not null,
  category text not null default 'leave'
    check (category in ('leave', 'attendance', 'system')),
  title text not null,
  body text not null,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sigaji_mobile_notifications_nik_idx
  on public.sigaji_mobile_notifications (tenant_key, nik, created_at desc);

create index if not exists sigaji_mobile_notifications_unread_idx
  on public.sigaji_mobile_notifications (tenant_key, nik)
  where read_at is null;

alter table public.sigaji_mobile_notifications enable row level security;

drop policy if exists "sigaji_mobile_notifications_main" on public.sigaji_mobile_notifications;
create policy "sigaji_mobile_notifications_main" on public.sigaji_mobile_notifications for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');
