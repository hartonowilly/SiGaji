-- =============================================================================
-- SiGaji v12.1 — tutup sisa bocoran HRD cabang (jalankan SETELAH v12)
--
--  1) HRD cabang tidak bisa membaca dokumen store "users" (email/role cabang lain).
--  2) Lokasi kerja punya cabang_id — HRD cabang hanya melihat lokasi cabangnya
--     (kosong = lokasi bersama, terlihat semua).
-- Bisa dijalankan ulang. Functions mobile tetap memfilter (service role menembus RLS).
-- =============================================================================

begin;

-- Store: HRD cabang tidak membaca daftar user (masih boleh approvals/notifikasi/audit).
drop policy if exists v12_staff_select on public.sigaji_store;
create policy v12_staff_select on public.sigaji_store for select to authenticated
  using (
    tenant_key = any ((select public.sigaji_staff_tenants())::text[])
    and (tenant_key = any ((select public.sigaji_hq_tenants())::text[])
         or store_key not in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot', 'users'))
  );

-- Lokasi kerja: cabang_id (null/kosong = lokasi bersama). Lewati bila tabel mobile belum ada.
do $$
begin
  if to_regclass('public.sigaji_work_locations') is null then
    raise notice 'sigaji_work_locations belum ada — lewati RLS lokasi (jalankan supabase_sigaji_mobile_attendance.sql, lalu ulangi file ini)';
    return;
  end if;
  execute 'alter table public.sigaji_work_locations add column if not exists cabang_id text';
  execute 'create index if not exists sigaji_work_locations_cabang_idx on public.sigaji_work_locations (tenant_key, cabang_id)';
  execute 'drop policy if exists "sigaji_work_locations_main" on public.sigaji_work_locations';
  execute 'drop policy if exists v12_loc_select on public.sigaji_work_locations';
  execute 'drop policy if exists v12_loc_write on public.sigaji_work_locations';
  execute $p$
    create policy v12_loc_select on public.sigaji_work_locations for select to authenticated
      using (
        tenant_key = any ((select public.sigaji_member_tenants())::text[])
        and (
          tenant_key = any ((select public.sigaji_hq_tenants())::text[])
          or coalesce(btrim(cabang_id), '') = ''
          or (tenant_key || '|' || cabang_id) = any ((select public.sigaji_branch_scopes())::text[])
        )
      )
  $p$;
  execute $p$
    create policy v12_loc_write on public.sigaji_work_locations for all to authenticated
      using (
        tenant_key = any ((select public.sigaji_hq_tenants())::text[])
        or (tenant_key || '|' || coalesce(nullif(btrim(cabang_id), ''), 'utama'))
           = any ((select public.sigaji_branch_scopes())::text[])
      )
      with check (
        tenant_key = any ((select public.sigaji_hq_tenants())::text[])
        or (tenant_key || '|' || coalesce(nullif(btrim(cabang_id), ''), 'utama'))
           = any ((select public.sigaji_branch_scopes())::text[])
      )
  $p$;
end $$;

commit;

-- select policyname from pg_policies where tablename = 'sigaji_store' and policyname = 'v12_staff_select';
