-- Riwayat slip gaji/THR yang sudah dikirim lewat email (per tenant + periode)
-- Jalankan di Supabase SQL Editor. Lalu perbarui grant: sql/supabase_data_api_grants.sql

create table if not exists public.sigaji_slip_email_sent (
  tenant_key text not null,
  nik text not null,
  period_nama text not null,
  slip_type text not null,
  sent_at timestamptz not null default now(),
  sent_to text,
  primary key (tenant_key, nik, period_nama, slip_type),
  constraint sigaji_slip_email_sent_type_chk check (slip_type in ('gaji', 'thr'))
);

create index if not exists sigaji_slip_email_sent_period_idx
  on public.sigaji_slip_email_sent (tenant_key, period_nama);

alter table public.sigaji_slip_email_sent enable row level security;

drop policy if exists "sigaji_slip_email_sent_select" on public.sigaji_slip_email_sent;
create policy "sigaji_slip_email_sent_select"
  on public.sigaji_slip_email_sent for select
  to authenticated
  using (tenant_key = 'main');

drop policy if exists "sigaji_slip_email_sent_ins" on public.sigaji_slip_email_sent;
create policy "sigaji_slip_email_sent_ins"
  on public.sigaji_slip_email_sent for insert
  to authenticated
  with check (tenant_key = 'main');

drop policy if exists "sigaji_slip_email_sent_upd" on public.sigaji_slip_email_sent;
create policy "sigaji_slip_email_sent_upd"
  on public.sigaji_slip_email_sent for update
  to authenticated
  using (tenant_key = 'main')
  with check (tenant_key = 'main');
