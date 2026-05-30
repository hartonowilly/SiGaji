-- SiGaji Telegram integration tables (tenant-aware)
-- Jalankan di Supabase SQL Editor.

create table if not exists public.sigaji_telegram_links (
  tenant_key text not null,
  nik text not null,
  chat_id text not null,
  tg_username text,
  tg_first_name text,
  tg_last_name text,
  linked_at timestamptz not null default now(),
  primary key (tenant_key, nik)
);

create table if not exists public.sigaji_telegram_link_requests (
  tenant_key text not null,
  nik text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (tenant_key, nik)
);

create index if not exists sigaji_telegram_link_requests_code_idx
on public.sigaji_telegram_link_requests (tenant_key, code);

alter table public.sigaji_telegram_links enable row level security;
alter table public.sigaji_telegram_link_requests enable row level security;

-- Minimal policies: allow authenticated to read link status for tenant 'main'.
-- Write operations dilakukan oleh Netlify Functions memakai SERVICE_ROLE key (bypass RLS).
drop policy if exists "read telegram links main" on public.sigaji_telegram_links;
create policy "read telegram links main"
on public.sigaji_telegram_links for select
to authenticated
using (tenant_key = 'main');

drop policy if exists "read telegram requests main" on public.sigaji_telegram_link_requests;
create policy "read telegram requests main"
on public.sigaji_telegram_link_requests for select
to authenticated
using (tenant_key = 'main');

