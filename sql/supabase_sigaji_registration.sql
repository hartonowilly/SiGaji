-- SiGaji: Email registration requests (admin approval)
-- Jalankan di Supabase SQL Editor.

create table if not exists public.sigaji_registration_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null default 'main',
  email text not null,
  nama text,
  nik text,
  status text not null default 'pending', -- pending | approved | rejected
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);

create index if not exists sigaji_registration_requests_tenant_status_idx
on public.sigaji_registration_requests (tenant_key, status, created_at desc);

create unique index if not exists sigaji_registration_requests_unique_pending_email
on public.sigaji_registration_requests (tenant_key, lower(email))
where status = 'pending';

alter table public.sigaji_registration_requests enable row level security;

-- Minimal read for authenticated (optional). Write/approve dilakukan via Netlify Functions pakai SERVICE_ROLE.
drop policy if exists "read registration requests main" on public.sigaji_registration_requests;
create policy "read registration requests main"
on public.sigaji_registration_requests for select
to authenticated
using (tenant_key = 'main');

