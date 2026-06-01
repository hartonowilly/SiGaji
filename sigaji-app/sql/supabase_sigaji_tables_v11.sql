-- =============================================================================
-- SiGaji v11 — penyimpanan ter-normalisasi (tetap pakai Supabase free tier)
-- Jalankan SEKALI di Supabase → SQL Editor (setelah sigaji_cloud sudah ada).
-- Lalu jalankan: sql/supabase_data_api_grants.sql (versi terbaru).
-- =============================================================================
-- Mode aplikasi (config.js): SIGAJI_STORAGE_MODE = 'dual' | 'tables' | 'blob'
--   dual   = baca/tulis tabel + cadangan blob (disarankan saat migrasi)
--   tables = hanya tabel
--   blob   = perilaku lama (satu kolom jsonb)

-- Metadata tenant
create table if not exists public.sigaji_tenant_meta (
  tenant_key text primary key default 'main',
  schema_version int not null default 10,
  storage_note text,
  updated_at timestamptz not null default now()
);

-- Satu baris per karyawan (data lengkap: gaji, tunjangan, bpjs, natura, dll.)
create table if not exists public.sigaji_karyawan (
  tenant_key text not null default 'main',
  nik text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, nik)
);

create index if not exists sigaji_karyawan_tenant_idx on public.sigaji_karyawan (tenant_key);

-- Periode gaji
create table if not exists public.sigaji_periode (
  tenant_key text not null default 'main',
  nama text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, nama)
);

-- Definisi kolom tunjangan variabel (Bonus, Uang Makan, ...)
create table if not exists public.sigaji_tunj_var_kolom (
  tenant_key text not null default 'main',
  id text not null,
  nama text not null default '',
  sort_order int not null default 0,
  primary key (tenant_key, id)
);

-- Nilai tunjangan variabel per periode × karyawan × kolom (cocok untuk import Excel massal)
create table if not exists public.sigaji_tunj_var_nilai (
  tenant_key text not null default 'main',
  periode_nama text not null,
  nik text not null,
  kolom_id text not null,
  nilai numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, periode_nama, nik, kolom_id)
);

create index if not exists sigaji_tunj_var_nilai_periode_idx
  on public.sigaji_tunj_var_nilai (tenant_key, periode_nama);

-- Data lain (absensi, lembur, karSnapshot, users, ...) — satu dokumen per kunci
create table if not exists public.sigaji_store (
  tenant_key text not null default 'main',
  store_key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, store_key)
);

-- RLS: sama seperti sigaji_cloud — semua user terautentikasi, tenant main
alter table public.sigaji_tenant_meta enable row level security;
alter table public.sigaji_karyawan enable row level security;
alter table public.sigaji_periode enable row level security;
alter table public.sigaji_tunj_var_kolom enable row level security;
alter table public.sigaji_tunj_var_nilai enable row level security;
alter table public.sigaji_store enable row level security;

drop policy if exists "sigaji_tenant_meta_all" on public.sigaji_tenant_meta;
create policy "sigaji_tenant_meta_all" on public.sigaji_tenant_meta for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_karyawan_all" on public.sigaji_karyawan;
create policy "sigaji_karyawan_all" on public.sigaji_karyawan for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_periode_all" on public.sigaji_periode;
create policy "sigaji_periode_all" on public.sigaji_periode for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_tunj_var_kolom_all" on public.sigaji_tunj_var_kolom;
create policy "sigaji_tunj_var_kolom_all" on public.sigaji_tunj_var_kolom for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_tunj_var_nilai_all" on public.sigaji_tunj_var_nilai;
create policy "sigaji_tunj_var_nilai_all" on public.sigaji_tunj_var_nilai for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');

drop policy if exists "sigaji_store_all" on public.sigaji_store;
create policy "sigaji_store_all" on public.sigaji_store for all to authenticated
  using (tenant_key = 'main') with check (tenant_key = 'main');
