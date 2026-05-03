-- Jalankan di Supabase → SQL Editor → New query → Paste → Run
-- Model awal: satu snapshot per user_id.
--
-- Untuk banyak orang (Admin + HRD) dengan SATU data perusahaan, aplikasi terbaru
-- membaca/menulis baris dengan tenant_key = main. Setelah tabel ini ada,
-- jalankan juga: sql/supabase_migrate_to_shared_payload.sql

create table if not exists public.sigaji_cloud (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint sigaji_cloud_user_unique unique (user_id)
);

alter table public.sigaji_cloud enable row level security;

create policy "sigaji_cloud_select_own"
  on public.sigaji_cloud for select
  using (auth.uid () = user_id);

create policy "sigaji_cloud_insert_own"
  on public.sigaji_cloud for insert
  with check (auth.uid () = user_id);

create policy "sigaji_cloud_update_own"
  on public.sigaji_cloud for update
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

create policy "sigaji_cloud_delete_own"
  on public.sigaji_cloud for delete
  using (auth.uid () = user_id);
