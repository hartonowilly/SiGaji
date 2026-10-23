-- =============================================================================
-- SiGaji v12 — versi per baris, simpan atomik tanpa saling timpa, akses per cabang
-- Jalankan SEKALI di Supabase → SQL Editor (aman diulang). Prasyarat: supabase_sigaji_tables_v11.sql.
--
-- Isi:
--   1) sigaji_user_roles: peta akun login → role/NIK/cabang (diisi otomatis dari daftar user, cocok email)
--   2) kolom version/updated_by + cabang_id; tabel sigaji_item (absensi/lembur/prorata/THR/snapshot per baris)
--      dan sigaji_deleted (jejak hapus untuk tarik perubahan)
--   3) RPC sigaji_save_rows (simpan hanya bila versi masih sama), sigaji_changes_since (tarik perubahan),
--      sigaji_sync_user_roles (sinkron hak akses dari Manajemen User)
--   4) RLS ketat untuk SEMUA tenant:
--        Admin, HRD tanpa cabang  = kantor pusat: semua data tenant-nya
--        HRD dengan cabang         = hanya karyawan/absensi/tunjangan cabang itu; master & periode baca saja
--        Karyawan                  = hanya data NIK sendiri (tidak lagi bisa membaca absensi seluruh karyawan)
--      Kebijakan lama yang longgar (termasuk per tenant dari supabase_tenant_add.sql) dihapus.
--
-- Urutan aman: deploy aplikasi versi baru dulu → semua user refresh → jalankan file ini saat tidak ada yang
-- sedang mengedit → semua user refresh lagi.
-- Jika berhenti dengan pesan "belum punya Admin/HRD": isi Email Supabase user Admin di Manajemen User,
-- simpan, lalu jalankan lagi. Tidak ada yang berubah sebelum file selesai tanpa error.
-- =============================================================================

begin;

-- ── 1) Peta akun login → role ───────────────────────────────────────────────
create table if not exists public.sigaji_user_roles (
  tenant_key text not null default 'main',
  auth_uid uuid not null references auth.users (id) on delete cascade,
  role text not null,
  nik text,
  email text,
  username text,
  aktif boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, auth_uid)
);
alter table public.sigaji_user_roles add column if not exists cabang_id text;
-- Role kustom (mis. "Supervisor") ikut tersinkron; hak data tetap hanya Admin/HRD.
alter table public.sigaji_user_roles drop constraint if exists sigaji_user_roles_role_check;
create index if not exists sigaji_user_roles_uid_idx on public.sigaji_user_roles (auth_uid);
alter table public.sigaji_user_roles enable row level security;

-- Fungsi bantu (security definer, dipanggil sekali per query lewat (select ...)).
create or replace function public.sigaji_member_tenants()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.tenant_key), '{}'::text[])
  from public.sigaji_user_roles r
  where r.auth_uid = auth.uid() and r.aktif;
$$;

create or replace function public.sigaji_staff_tenants()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.tenant_key), '{}'::text[])
  from public.sigaji_user_roles r
  where r.auth_uid = auth.uid() and r.aktif and r.role in ('Admin', 'HRD');
$$;

/** Kantor pusat: Admin, atau HRD tanpa cabang. */
create or replace function public.sigaji_hq_tenants()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.tenant_key), '{}'::text[])
  from public.sigaji_user_roles r
  where r.auth_uid = auth.uid() and r.aktif
    and (r.role = 'Admin' or (r.role = 'HRD' and coalesce(btrim(r.cabang_id), '') = ''));
$$;

/** HRD cabang: 'tenant|cabang' (cabang_id boleh beberapa, pisah koma). */
create or replace function public.sigaji_branch_scopes()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.tenant_key || '|' || btrim(c)), '{}'::text[])
  from public.sigaji_user_roles r
  cross join lateral unnest(string_to_array(r.cabang_id, ',')) c
  where r.auth_uid = auth.uid() and r.aktif and r.role = 'HRD'
    and coalesce(btrim(r.cabang_id), '') <> '' and btrim(c) <> '';
$$;

/** 'tenant|nik' milik akun login (data diri sendiri). */
create or replace function public.sigaji_self_keys()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.tenant_key || '|' || btrim(r.nik)), '{}'::text[])
  from public.sigaji_user_roles r
  where r.auth_uid = auth.uid() and r.aktif and coalesce(btrim(r.nik), '') <> '';
$$;

grant execute on function public.sigaji_member_tenants() to authenticated;
grant execute on function public.sigaji_staff_tenants() to authenticated;
grant execute on function public.sigaji_hq_tenants() to authenticated;
grant execute on function public.sigaji_branch_scopes() to authenticated;
grant execute on function public.sigaji_self_keys() to authenticated;

-- Isi peta dari daftar user (store users, atau blob bila tenant belum pakai tabel). Cocokkan auth_uid lalu email.
create temp table sigaji_v12_users_src (tenant_key text, e jsonb) on commit drop;

insert into sigaji_v12_users_src
select s.tenant_key, x
from public.sigaji_store s
cross join lateral jsonb_array_elements(case when jsonb_typeof(s.data) = 'array' then s.data else '[]'::jsonb end) x
where s.store_key = 'users';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sigaji_cloud' and column_name = 'tenant_key'
  ) then
    insert into sigaji_v12_users_src
    select c.tenant_key, x
    from public.sigaji_cloud c
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(c.payload -> 'users') = 'array' then c.payload -> 'users' else '[]'::jsonb end
    ) x
    where c.tenant_key is not null
      and not exists (
        select 1 from public.sigaji_store s where s.tenant_key = c.tenant_key and s.store_key = 'users'
      );
  end if;
end $$;

insert into public.sigaji_user_roles (tenant_key, auth_uid, role, nik, email, username, aktif, cabang_id, updated_at)
select distinct on (m.tenant_key, m.uid)
  m.tenant_key,
  m.uid,
  coalesce(nullif(btrim(m.e ->> 'role'), ''), 'Karyawan'),
  nullif(btrim(m.e ->> 'nik'), ''),
  lower(nullif(btrim(m.e ->> 'email'), '')),
  nullif(btrim(m.e ->> 'username'), ''),
  coalesce(m.e ->> 'aktif', 'true') <> 'false',
  nullif(btrim(m.e ->> 'cabangId'), ''),
  now()
from (
  select s.tenant_key, s.e,
    coalesce(
      (select u.id from auth.users u where u.id::text = nullif(btrim(s.e ->> 'auth_uid'), '')),
      (select u.id from auth.users u
        where lower(u.email) = lower(nullif(btrim(s.e ->> 'email'), '')) order by u.created_at limit 1)
    ) as uid
  from sigaji_v12_users_src s
) m
where m.uid is not null
order by m.tenant_key, m.uid, (coalesce(m.e ->> 'aktif', 'true') = 'false')
on conflict (tenant_key, auth_uid) do update set
  role = excluded.role,
  nik = excluded.nik,
  email = excluded.email,
  username = excluded.username,
  aktif = excluded.aktif,
  cabang_id = coalesce(excluded.cabang_id, public.sigaji_user_roles.cabang_id),
  updated_at = now();

-- Jangan kunci tenant mana pun: setiap tenant yang punya data wajib punya Admin/HRD tertaut.
do $$
declare
  t text;
  bad text[] := '{}';
begin
  for t in
    select tk from (
      select tenant_key tk from public.sigaji_tenant_meta
      union select tenant_key from public.sigaji_karyawan
      union select tenant_key from public.sigaji_store
    ) a
    where exists (select 1 from public.sigaji_karyawan k where k.tenant_key = a.tk)
       or exists (select 1 from public.sigaji_store s where s.tenant_key = a.tk)
  loop
    if not exists (
      select 1 from public.sigaji_user_roles r
      where r.tenant_key = t and r.aktif and r.role in ('Admin', 'HRD')
    ) then
      bad := bad || t;
    end if;
  end loop;
  if array_length(bad, 1) > 0 then
    raise exception 'Tenant % belum punya Admin/HRD yang tertaut ke akun login. Isi "Email Supabase" user Admin di Manajemen User (sama dengan email login), simpan, lalu jalankan file ini lagi. Tidak ada yang diubah.', bad;
  end if;
end $$;

-- ── 2) Versi per baris + cabang ─────────────────────────────────────────────
alter table public.sigaji_karyawan
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by uuid,
  add column if not exists cabang_id text not null default 'utama';
alter table public.sigaji_periode
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by uuid;
alter table public.sigaji_store
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by uuid;
alter table public.sigaji_tunj_var_nilai
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by uuid,
  add column if not exists cabang_id text not null default 'utama';
alter table public.sigaji_tunj_var_kolom
  add column if not exists version bigint not null default 1,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.sigaji_item (
  tenant_key text not null default 'main',
  kind text not null check (kind in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot')),
  item_key text not null,
  nik text not null default '',
  cabang_id text not null default 'utama',
  data jsonb not null default 'null'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (tenant_key, kind, item_key)
);

create table if not exists public.sigaji_deleted (
  id bigserial primary key,
  tenant_key text not null,
  tbl text not null,
  row_key jsonb not null,
  cabang_id text,
  nik text,
  deleted_at timestamptz not null default clock_timestamp()
);

create index if not exists sigaji_item_nik_idx on public.sigaji_item (tenant_key, nik);
create index if not exists sigaji_item_updated_idx on public.sigaji_item (tenant_key, updated_at);
create index if not exists sigaji_karyawan_updated_idx on public.sigaji_karyawan (tenant_key, updated_at);
create index if not exists sigaji_karyawan_cabang_idx on public.sigaji_karyawan (tenant_key, cabang_id);
create index if not exists sigaji_periode_updated_idx on public.sigaji_periode (tenant_key, updated_at);
create index if not exists sigaji_store_updated_idx on public.sigaji_store (tenant_key, updated_at);
create index if not exists sigaji_tunj_nilai_updated_idx on public.sigaji_tunj_var_nilai (tenant_key, updated_at);
create index if not exists sigaji_tunj_nilai_nik_idx on public.sigaji_tunj_var_nilai (tenant_key, nik);
create index if not exists sigaji_tunj_kolom_updated_idx on public.sigaji_tunj_var_kolom (tenant_key, updated_at);
create index if not exists sigaji_deleted_tenant_idx on public.sigaji_deleted (tenant_key, deleted_at);

update public.sigaji_karyawan
set cabang_id = coalesce(nullif(btrim(data ->> 'cabangId'), ''), nullif(btrim(data ->> 'cabang'), ''), 'utama')
where cabang_id is distinct from coalesce(nullif(btrim(data ->> 'cabangId'), ''), nullif(btrim(data ->> 'cabang'), ''), 'utama');

update public.sigaji_tunj_var_nilai n
set cabang_id = k.cabang_id
from public.sigaji_karyawan k
where k.tenant_key = n.tenant_key and k.nik = n.nik and n.cabang_id is distinct from k.cabang_id;

-- Versi naik hanya bila isi berubah (upsert tanpa perubahan tidak dianggap perubahan).
create or replace function public.sigaji_touch_row()
returns trigger language plpgsql set search_path = public as $$
declare
  meta constant text[] := array['version', 'updated_at', 'updated_by', 'cabang_id'];
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.updated_at := clock_timestamp();
    new.updated_by := auth.uid();
    return new;
  end if;
  if (to_jsonb(new) - meta) is distinct from (to_jsonb(old) - meta) then
    new.version := coalesce(old.version, 0) + 1;
    new.updated_at := clock_timestamp();
    new.updated_by := auth.uid();
  else
    new.version := old.version;
    new.updated_by := old.updated_by;
    -- Pindah cabang: muncul di tarik perubahan tanpa dianggap edit.
    if (to_jsonb(new) -> 'cabang_id') is distinct from (to_jsonb(old) -> 'cabang_id') then
      new.updated_at := clock_timestamp();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end $$;

create or replace function public.sigaji_karyawan_cabang()
returns trigger language plpgsql set search_path = public as $$
begin
  new.cabang_id := coalesce(nullif(btrim(new.data ->> 'cabangId'), ''), nullif(btrim(new.data ->> 'cabang'), ''), 'utama');
  return new;
end $$;

-- Cabang baris absensi/tunjangan = cabang karyawan (security definer: tidak bisa dipalsukan klien).
create or replace function public.sigaji_row_cabang_from_karyawan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  select k.cabang_id into c from public.sigaji_karyawan k where k.tenant_key = new.tenant_key and k.nik = new.nik;
  if c is null and tg_op = 'UPDATE' then
    c := old.cabang_id;
  end if;
  new.cabang_id := coalesce(c, 'utama');
  return new;
end $$;

create or replace function public.sigaji_karyawan_cabang_propagate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.sigaji_item set cabang_id = new.cabang_id
  where tenant_key = new.tenant_key and nik = new.nik and cabang_id is distinct from new.cabang_id;
  update public.sigaji_tunj_var_nilai set cabang_id = new.cabang_id
  where tenant_key = new.tenant_key and nik = new.nik and cabang_id is distinct from new.cabang_id;
  return null;
end $$;

/** Jejak hapus — argumen trigger = kolom kunci baris. */
create or replace function public.sigaji_log_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb := to_jsonb(old);
  k jsonb := '{}'::jsonb;
  i int;
begin
  for i in 0 .. tg_nargs - 1 loop
    k := k || jsonb_build_object(tg_argv[i], o -> tg_argv[i]);
  end loop;
  insert into public.sigaji_deleted (tenant_key, tbl, row_key, cabang_id, nik)
  values (old.tenant_key, tg_table_name, k, o ->> 'cabang_id', o ->> 'nik');
  if random() < 0.01 then
    delete from public.sigaji_deleted where deleted_at < now() - interval '14 days';
  end if;
  return null;
end $$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('sigaji_karyawan', 'nik'),
      ('sigaji_periode', 'nama'),
      ('sigaji_store', 'store_key'),
      ('sigaji_item', 'kind,item_key'),
      ('sigaji_tunj_var_nilai', 'periode_nama,nik,kolom_id'),
      ('sigaji_tunj_var_kolom', 'id')
    ) v(tbl, keys)
  loop
    execute format('drop trigger if exists sigaji_20_touch on public.%I', t.tbl);
    execute format(
      'create trigger sigaji_20_touch before insert or update on public.%I for each row execute function public.sigaji_touch_row()',
      t.tbl
    );
    execute format('drop trigger if exists sigaji_90_log_delete on public.%I', t.tbl);
    execute format(
      'create trigger sigaji_90_log_delete after delete on public.%I for each row execute function public.sigaji_log_delete(%s)',
      t.tbl,
      (select string_agg(quote_literal(x), ', ') from unnest(string_to_array(t.keys, ',')) x)
    );
  end loop;
end $$;

drop trigger if exists sigaji_10_cabang on public.sigaji_karyawan;
create trigger sigaji_10_cabang before insert or update on public.sigaji_karyawan
  for each row execute function public.sigaji_karyawan_cabang();
drop trigger if exists sigaji_30_cabang_propagate on public.sigaji_karyawan;
create trigger sigaji_30_cabang_propagate after update on public.sigaji_karyawan
  for each row when (old.cabang_id is distinct from new.cabang_id)
  execute function public.sigaji_karyawan_cabang_propagate();
drop trigger if exists sigaji_10_cabang on public.sigaji_item;
create trigger sigaji_10_cabang before insert or update on public.sigaji_item
  for each row execute function public.sigaji_row_cabang_from_karyawan();
drop trigger if exists sigaji_10_cabang on public.sigaji_tunj_var_nilai;
create trigger sigaji_10_cabang before insert or update on public.sigaji_tunj_var_nilai
  for each row execute function public.sigaji_row_cabang_from_karyawan();

-- ── 3) Pindahkan absensi/lembur/prorata/THR/snapshot dari dokumen besar ke baris ─
-- Kunci baris sama dengan js/cloud-delta.js (absensi: "nik|YYYY-MM", THR/snapshot: "periode|nik", lainnya: nik).
-- Dokumen lama di sigaji_store dibiarkan sebagai arsip (tidak dibaca aplikasi v12).
insert into public.sigaji_item (tenant_key, kind, item_key, nik, data)
select s.tenant_key, 'absensi', n.key || '|' || m.bulan, n.key, m.hari
from public.sigaji_store s
cross join lateral jsonb_each(case when jsonb_typeof(s.data) = 'object' then s.data else '{}'::jsonb end) n
cross join lateral (
  select case when d.key ~ '^\d{4}-\d{2}' then substr(d.key, 1, 7) else 'lain' end as bulan,
         jsonb_object_agg(d.key, d.value) as hari
  from jsonb_each(case when jsonb_typeof(n.value) = 'object' then n.value else '{}'::jsonb end) d
  where d.value <> 'null'::jsonb and d.value <> '""'::jsonb
  group by 1
) m
where s.store_key = 'absensi'
on conflict do nothing;

insert into public.sigaji_item (tenant_key, kind, item_key, nik, data)
select s.tenant_key, s.store_key, n.key, n.key, n.value
from public.sigaji_store s
cross join lateral jsonb_each(case when jsonb_typeof(s.data) = 'object' then s.data else '{}'::jsonb end) n
where s.store_key in ('lembur', 'prorata')
  and n.value not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb)
on conflict do nothing;

insert into public.sigaji_item (tenant_key, kind, item_key, nik, data)
select s.tenant_key, s.store_key, p.key || '|' || n.key, n.key, n.value
from public.sigaji_store s
cross join lateral jsonb_each(case when jsonb_typeof(s.data) = 'object' then s.data else '{}'::jsonb end) p
cross join lateral jsonb_each(case when jsonb_typeof(p.value) = 'object' then p.value else '{}'::jsonb end) n
where s.store_key in ('thrManual', 'karSnapshot')
  and n.value <> 'null'::jsonb
on conflict do nothing;

-- ── 4) RPC simpan atomik ────────────────────────────────────────────────────
-- p_upserts: [{key:{...}, data, base_version (null = baris baru), blind?, nik? (item)}]
-- p_deletes: [{key:{...}, base_version}]
-- Baris ditulis hanya bila versinya masih = base_version; selain itu dikembalikan di "conflicts"
-- beserta data awan terbaru agar klien menggabung lalu mencoba lagi. RLS tetap berlaku (security invoker).
create or replace function public.sigaji_save_rows(
  p_table text,
  p_upserts jsonb default '[]'::jsonb,
  p_deletes jsonb default '[]'::jsonb,
  p_tenant text default 'main'
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  tbl text;
  keycols text[];
  where_sql text;
  u jsonb;
  k jsonb;
  blind boolean;
  v_version bigint;
  v_data jsonb;
  new_version bigint;
  n int;
  saved jsonb := '[]'::jsonb;
  deleted jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  errors jsonb := '[]'::jsonb;
begin
  case p_table
    when 'karyawan' then tbl := 'sigaji_karyawan'; keycols := array['nik'];
    when 'periode' then tbl := 'sigaji_periode'; keycols := array['nama'];
    when 'store' then tbl := 'sigaji_store'; keycols := array['store_key'];
    when 'item' then tbl := 'sigaji_item'; keycols := array['kind', 'item_key'];
    else raise exception 'sigaji_save_rows: tabel tidak dikenal %', p_table using errcode = '22023';
  end case;
  select 'tenant_key = $1' || string_agg(format(' and %I = ($2 ->> %L)', c, c), '')
    into where_sql from unnest(keycols) c;

  for u in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
    k := u -> 'key';
    blind := coalesce((u ->> 'blind')::boolean, false);
    begin
      if exists (select 1 from unnest(keycols) c where coalesce(k ->> c, '') = '') then
        raise exception 'kunci kosong' using errcode = '22023';
      end if;
      execute format('select version, data from public.%I where %s for update', tbl, where_sql)
        into v_version, v_data using p_tenant, k;
      get diagnostics n = row_count;
      if n = 0 then
        if not blind and (u ->> 'base_version') is not null then
          conflicts := conflicts || jsonb_build_array(jsonb_build_object('key', k, 'missing', true));
          continue;
        end if;
        if p_table = 'item' then
          insert into public.sigaji_item (tenant_key, kind, item_key, nik, data)
          values (p_tenant, k ->> 'kind', k ->> 'item_key', coalesce(u ->> 'nik', ''), coalesce(u -> 'data', 'null'::jsonb))
          returning version into new_version;
        else
          execute format(
            'insert into public.%I (tenant_key, %I, data) values ($1, $2 ->> %L, coalesce($3 -> ''data'', ''{}''::jsonb)) returning version',
            tbl, keycols[1], keycols[1]
          ) into new_version using p_tenant, k, u;
        end if;
      else
        if not blind and (u ->> 'base_version') is distinct from v_version::text then
          conflicts := conflicts || jsonb_build_array(jsonb_build_object('key', k, 'version', v_version, 'data', v_data));
          continue;
        end if;
        execute format('update public.%I set data = coalesce($3 -> ''data'', data) where %s returning version', tbl, where_sql)
          into new_version using p_tenant, k, u;
        get diagnostics n = row_count;
        if n = 0 then
          raise exception 'tidak diizinkan' using errcode = '42501';
        end if;
      end if;
      saved := saved || jsonb_build_array(jsonb_build_object('key', k, 'version', new_version));
    exception when others then
      errors := errors || jsonb_build_array(jsonb_build_object(
        'key', k,
        'code', sqlstate,
        'message', case when sqlstate in ('42501', '23505') then 'Tidak diizinkan (hak akses cabang / kantor pusat)' else sqlerrm end
      ));
    end;
  end loop;

  for u in select value from jsonb_array_elements(coalesce(p_deletes, '[]'::jsonb)) loop
    k := u -> 'key';
    blind := coalesce((u ->> 'blind')::boolean, false);
    begin
      execute format('select version, data from public.%I where %s for update', tbl, where_sql)
        into v_version, v_data using p_tenant, k;
      get diagnostics n = row_count;
      if n = 0 then
        deleted := deleted || jsonb_build_array(k);
        continue;
      end if;
      if not blind and (u ->> 'base_version') is not null and (u ->> 'base_version') <> v_version::text then
        conflicts := conflicts || jsonb_build_array(jsonb_build_object('key', k, 'version', v_version, 'data', v_data, 'delete', true));
        continue;
      end if;
      execute format('delete from public.%I where %s', tbl, where_sql) using p_tenant, k;
      get diagnostics n = row_count;
      if n = 0 then
        raise exception 'tidak diizinkan' using errcode = '42501';
      end if;
      deleted := deleted || jsonb_build_array(k);
    exception when others then
      errors := errors || jsonb_build_array(jsonb_build_object(
        'key', k,
        'code', sqlstate,
        'message', case when sqlstate = '42501' then 'Tidak diizinkan menghapus (hak akses cabang / kantor pusat)' else sqlerrm end
      ));
    end;
  end loop;

  return jsonb_build_object('saved', saved, 'deleted', deleted, 'conflicts', conflicts, 'errors', errors);
end $$;

-- Tarik perubahan sejak waktu server tertentu (RLS berlaku). "now" = jam server untuk tarikan berikutnya.
create or replace function public.sigaji_changes_since(p_since timestamptz, p_tenant text default 'main')
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'now', now(),
    'karyawan', (select coalesce(jsonb_agg(jsonb_build_object('nik', nik, 'data', data, 'version', version)), '[]'::jsonb)
      from public.sigaji_karyawan where tenant_key = p_tenant and updated_at >= p_since),
    'periode', (select coalesce(jsonb_agg(jsonb_build_object('nama', nama, 'data', data, 'version', version)), '[]'::jsonb)
      from public.sigaji_periode where tenant_key = p_tenant and updated_at >= p_since),
    'store', (select coalesce(jsonb_agg(jsonb_build_object('store_key', store_key, 'data', data, 'version', version)), '[]'::jsonb)
      from public.sigaji_store where tenant_key = p_tenant and updated_at >= p_since
        and store_key not in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot')),
    'item', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'item_key', item_key, 'nik', nik, 'data', data, 'version', version)), '[]'::jsonb)
      from public.sigaji_item where tenant_key = p_tenant and updated_at >= p_since),
    'tunj_nilai', (select coalesce(jsonb_agg(jsonb_build_object('periode_nama', periode_nama, 'nik', nik, 'kolom_id', kolom_id, 'nilai', nilai)), '[]'::jsonb)
      from public.sigaji_tunj_var_nilai where tenant_key = p_tenant and updated_at >= p_since),
    'tunj_kolom', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nama', nama, 'sort_order', sort_order)), '[]'::jsonb)
      from public.sigaji_tunj_var_kolom where tenant_key = p_tenant and updated_at >= p_since),
    -- Baris yang sudah dibuat lagi setelah dihapus tidak dilaporkan sebagai terhapus.
    'deleted', (select coalesce(jsonb_agg(jsonb_build_object('tbl', d.tbl, 'key', d.row_key) order by d.deleted_at), '[]'::jsonb)
      from public.sigaji_deleted d
      where d.tenant_key = p_tenant and d.deleted_at >= p_since
        and not (
          (d.tbl = 'sigaji_karyawan' and exists (select 1 from public.sigaji_karyawan x
            where x.tenant_key = d.tenant_key and x.nik = d.row_key ->> 'nik'))
          or (d.tbl = 'sigaji_periode' and exists (select 1 from public.sigaji_periode x
            where x.tenant_key = d.tenant_key and x.nama = d.row_key ->> 'nama'))
          or (d.tbl = 'sigaji_store' and exists (select 1 from public.sigaji_store x
            where x.tenant_key = d.tenant_key and x.store_key = d.row_key ->> 'store_key'))
          or (d.tbl = 'sigaji_item' and exists (select 1 from public.sigaji_item x
            where x.tenant_key = d.tenant_key and x.kind = d.row_key ->> 'kind' and x.item_key = d.row_key ->> 'item_key'))
          or (d.tbl = 'sigaji_tunj_var_nilai' and exists (select 1 from public.sigaji_tunj_var_nilai x
            where x.tenant_key = d.tenant_key and x.periode_nama = d.row_key ->> 'periode_nama'
              and x.nik = d.row_key ->> 'nik' and x.kolom_id = d.row_key ->> 'kolom_id'))
          or (d.tbl = 'sigaji_tunj_var_kolom' and exists (select 1 from public.sigaji_tunj_var_kolom x
            where x.tenant_key = d.tenant_key and x.id = d.row_key ->> 'id'))
        ))
  );
$$;

-- Manajemen User → peta akun login. Hanya kantor pusat. Akun dicari lewat auth_uid lalu email.
create or replace function public.sigaji_sync_user_roles(p_tenant text, p_users jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n_saved int := 0;
  n_off int := 0;
  unmatched jsonb;
begin
  if me is null or not (p_tenant = any (public.sigaji_hq_tenants())) then
    raise exception 'Hanya Admin / HRD kantor pusat yang boleh mengubah hak akses login' using errcode = '42501';
  end if;

  create temp table if not exists sigaji_sync_src (uid uuid, e jsonb) on commit drop;
  delete from sigaji_sync_src;
  insert into sigaji_sync_src
  select
    coalesce(
      (select u.id from auth.users u where u.id::text = nullif(btrim(x ->> 'auth_uid'), '')),
      (select u.id from auth.users u where lower(u.email) = lower(nullif(btrim(x ->> 'email'), '')) order by u.created_at limit 1)
    ),
    x
  from jsonb_array_elements(case when jsonb_typeof(p_users) = 'array' then p_users else '[]'::jsonb end) x;

  select coalesce(jsonb_agg(coalesce(e ->> 'username', e ->> 'email')), '[]'::jsonb) into unmatched
  from sigaji_sync_src
  where uid is null and coalesce(e ->> 'aktif', 'true') <> 'false' and coalesce(btrim(e ->> 'email'), '') <> '';

  insert into public.sigaji_user_roles (tenant_key, auth_uid, role, nik, email, username, aktif, cabang_id, updated_at)
  select distinct on (s.uid)
    p_tenant, s.uid,
    coalesce(nullif(btrim(s.e ->> 'role'), ''), 'Karyawan'),
    nullif(btrim(s.e ->> 'nik'), ''),
    lower(nullif(btrim(s.e ->> 'email'), '')),
    nullif(btrim(s.e ->> 'username'), ''),
    coalesce(s.e ->> 'aktif', 'true') <> 'false',
    nullif(btrim(s.e ->> 'cabangId'), ''),
    now()
  from sigaji_sync_src s
  where s.uid is not null and s.uid <> me
  order by s.uid, (coalesce(s.e ->> 'aktif', 'true') = 'false')
  on conflict (tenant_key, auth_uid) do update set
    role = excluded.role, nik = excluded.nik, email = excluded.email, username = excluded.username,
    aktif = excluded.aktif, cabang_id = excluded.cabang_id, updated_at = now()
  where (public.sigaji_user_roles.role, public.sigaji_user_roles.nik, public.sigaji_user_roles.email,
         public.sigaji_user_roles.username, public.sigaji_user_roles.aktif, public.sigaji_user_roles.cabang_id)
    is distinct from (excluded.role, excluded.nik, excluded.email, excluded.username, excluded.aktif, excluded.cabang_id);
  get diagnostics n_saved = row_count;

  -- Akun yang dihapus dari Manajemen User kehilangan akses (kecuali diri sendiri — cegah terkunci).
  -- Daftar kosong = data user belum termuat di klien, bukan "hapus semua".
  if exists (select 1 from sigaji_sync_src) then
    update public.sigaji_user_roles r set aktif = false, updated_at = now()
    where r.tenant_key = p_tenant and r.aktif and r.auth_uid <> me
      and not exists (select 1 from sigaji_sync_src s where s.uid = r.auth_uid);
    get diagnostics n_off = row_count;
  end if;

  return jsonb_build_object('saved', n_saved, 'deactivated', n_off, 'unmatched', unmatched);
end $$;

revoke all on function public.sigaji_save_rows(text, jsonb, jsonb, text) from public;
revoke all on function public.sigaji_changes_since(timestamptz, text) from public;
revoke all on function public.sigaji_sync_user_roles(text, jsonb) from public;
grant execute on function public.sigaji_save_rows(text, jsonb, jsonb, text) to authenticated, service_role;
grant execute on function public.sigaji_changes_since(timestamptz, text) to authenticated, service_role;
grant execute on function public.sigaji_sync_user_roles(text, jsonb) to authenticated;

-- ── 5) RLS ──────────────────────────────────────────────────────────────────
alter table public.sigaji_item enable row level security;
alter table public.sigaji_deleted enable row level security;

-- Hapus SEMUA kebijakan lama di tabel inti (kebijakan bersifat OR — satu yang longgar membuka semuanya).
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'sigaji_tenant_meta', 'sigaji_karyawan', 'sigaji_periode', 'sigaji_store', 'sigaji_tunj_var_kolom',
      'sigaji_tunj_var_nilai', 'sigaji_item', 'sigaji_deleted', 'sigaji_user_roles'
    )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Data per cabang: karyawan, item, tunjangan variabel.
do $$
declare
  t text;
  scope constant text :=
    '(tenant_key = any ((select public.sigaji_hq_tenants())::text[]) or (tenant_key || ''|'' || cabang_id) = any ((select public.sigaji_branch_scopes())::text[]))';
  self constant text := '((tenant_key || ''|'' || nik) = any ((select public.sigaji_self_keys())::text[]))';
begin
  foreach t in array array['sigaji_karyawan', 'sigaji_item', 'sigaji_tunj_var_nilai'] loop
    execute format('create policy v12_staff_select on public.%I for select to authenticated using (%s or %s)', t, scope, self);
    execute format('create policy v12_staff_insert on public.%I for insert to authenticated with check (%s)', t, scope);
    execute format('create policy v12_staff_update on public.%I for update to authenticated using (%s) with check (%s)', t, scope, scope);
    execute format('create policy v12_staff_delete on public.%I for delete to authenticated using (%s)', t, scope);
  end loop;
end $$;

-- Periode & kolom tunjangan: baca semua anggota tenant; ubah hanya kantor pusat.
do $$
declare
  t text;
begin
  foreach t in array array['sigaji_periode', 'sigaji_tunj_var_kolom', 'sigaji_tenant_meta'] loop
    execute format(
      'create policy v12_member_select on public.%I for select to authenticated using (tenant_key = any ((select public.sigaji_member_tenants())::text[]))', t);
    execute format(
      'create policy v12_hq_insert on public.%I for insert to authenticated with check (tenant_key = any ((select public.sigaji_hq_tenants())::text[]))', t);
    execute format(
      'create policy v12_hq_update on public.%I for update to authenticated using (tenant_key = any ((select public.sigaji_hq_tenants())::text[])) with check (tenant_key = any ((select public.sigaji_hq_tenants())::text[]))', t);
    execute format(
      'create policy v12_hq_delete on public.%I for delete to authenticated using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]))', t);
  end loop;
end $$;

-- Store: dokumen lama absensi/lembur/... tidak dibaca/ditulis lagi (pindah ke sigaji_item).
create policy v12_staff_select on public.sigaji_store for select to authenticated
  using (
    tenant_key = any ((select public.sigaji_staff_tenants())::text[])
    and (tenant_key = any ((select public.sigaji_hq_tenants())::text[])
         or store_key not in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot'))
  );
create policy v12_member_select on public.sigaji_store for select to authenticated
  using (
    tenant_key = any ((select public.sigaji_member_tenants())::text[])
    and store_key in ('perusahaan', 'masterCuti', 'hariLibur', 'notifikasi', 'roles', 'cabang', 'tunjVarLabels')
  );
create policy v12_write_insert on public.sigaji_store for insert to authenticated
  with check (
    store_key not in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot')
    and (tenant_key = any ((select public.sigaji_hq_tenants())::text[])
         or (tenant_key = any ((select public.sigaji_staff_tenants())::text[])
             and store_key in ('approvals', 'notifikasi', 'auditLog', 'bentoLayouts')))
  );
create policy v12_write_update on public.sigaji_store for update to authenticated
  using (
    tenant_key = any ((select public.sigaji_hq_tenants())::text[])
    or (tenant_key = any ((select public.sigaji_staff_tenants())::text[])
        and store_key in ('approvals', 'notifikasi', 'auditLog', 'bentoLayouts'))
  )
  with check (
    store_key not in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot')
    and (tenant_key = any ((select public.sigaji_hq_tenants())::text[])
         or (tenant_key = any ((select public.sigaji_staff_tenants())::text[])
             and store_key in ('approvals', 'notifikasi', 'auditLog', 'bentoLayouts')))
  );
create policy v12_hq_delete on public.sigaji_store for delete to authenticated
  using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));

-- Jejak hapus: hanya dibaca (ditulis trigger).
create policy v12_staff_select on public.sigaji_deleted for select to authenticated
  using (
    tenant_key = any ((select public.sigaji_hq_tenants())::text[])
    or (tenant_key = any ((select public.sigaji_staff_tenants())::text[]) and cabang_id is null)
    or (tenant_key || '|' || cabang_id) = any ((select public.sigaji_branch_scopes())::text[])
  );

-- Peta role: lihat diri sendiri; kantor pusat lihat semua (ubah lewat sigaji_sync_user_roles / langsung).
create policy v12_select_own on public.sigaji_user_roles for select to authenticated
  using (auth_uid = auth.uid());
create policy v12_hq_select on public.sigaji_user_roles for select to authenticated
  using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));
create policy v12_hq_insert on public.sigaji_user_roles for insert to authenticated
  with check (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));
create policy v12_hq_update on public.sigaji_user_roles for update to authenticated
  using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]))
  with check (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));
create policy v12_hq_delete on public.sigaji_user_roles for delete to authenticated
  using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]) and auth_uid <> auth.uid());

-- Blob cadangan berisi seluruh data tenant: hanya kantor pusat.
do $$
declare
  r record;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sigaji_cloud' and column_name = 'tenant_key'
  ) then
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'sigaji_cloud' loop
      execute format('drop policy %I on public.sigaji_cloud', r.policyname);
    end loop;
    alter table public.sigaji_cloud enable row level security;
    create policy v12_hq_select on public.sigaji_cloud for select to authenticated
      using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));
    create policy v12_hq_insert on public.sigaji_cloud for insert to authenticated
      with check (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));
    create policy v12_hq_update on public.sigaji_cloud for update to authenticated
      using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]))
      with check (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));
    create policy v12_hq_delete on public.sigaji_cloud for delete to authenticated
      using (tenant_key = any ((select public.sigaji_hq_tenants())::text[]));
  end if;
end $$;

-- ── 6) Grant ────────────────────────────────────────────────────────────────
grant select, insert, update, delete on table public.sigaji_item to authenticated;
grant select, insert, update, delete on table public.sigaji_item to service_role;
grant select on table public.sigaji_deleted to authenticated;
grant select, insert, update, delete on table public.sigaji_deleted to service_role;
grant usage, select on sequence public.sigaji_deleted_id_seq to service_role;
grant select, insert, update, delete on table public.sigaji_user_roles to authenticated;
grant select, insert, update, delete on table public.sigaji_user_roles to service_role;

update public.sigaji_tenant_meta set schema_version = greatest(coalesce(schema_version, 0), 12), updated_at = now();

commit;

-- ── Cek setelah jalan (opsional) ────────────────────────────────────────────
-- select tenant_key, role, coalesce(cabang_id, '(pusat)') cabang, count(*) from public.sigaji_user_roles
--   where aktif group by 1, 2, 3 order by 1, 2;
-- select tenant_key, kind, count(*) from public.sigaji_item group by 1, 2 order by 1, 2;
-- select tablename, policyname from pg_policies where schemaname = 'public' and tablename like 'sigaji_%' order by 1, 2;
--
-- Beri HRD cabang (ganti email & id cabang dari Master → Cabang), atau pilih cabang di Manajemen User:
-- update public.sigaji_user_roles set cabang_id = 'c2' where lower(email) = 'hrd.surabaya@contoh.com';
