-- =============================================================================
-- Tambah tenant BARU di Supabase yang SAMA (hosted multi-tenant).
--
-- CARA PAKAI:
--   1. Find & Replace di file ini: __TENANT_KEY__  →  pt_majubersama
--      (huruf kecil, underscore, tanpa spasi)
--   2. Sesuaikan max_employees / plan_label di INSERT di bawah.
--   3. Jalankan SELURUH file di Supabase → SQL Editor → Run.
--   4. Deploy Cloudflare baru dengan SIGAJI_TENANT_KEY = pt_majubersama
--
-- Tenant pertama (main) tidak perlu file ini.
-- Panduan: docs/MULTI_TENANT_HOSTED.md
-- =============================================================================

-- ── 1) Metadata & kuota (penjual) ─────────────────────────────────────────
insert into public.sigaji_tenant_meta (
  tenant_key,
  schema_version,
  max_employees,
  plan_label,
  storage_note,
  updated_at
)
values (
  '__TENANT_KEY__',
  10,
  20,
  'Basic',
  'tenant added via supabase_tenant_add.sql',
  now()
)
on conflict (tenant_key) do update set
  max_employees = excluded.max_employees,
  plan_label = excluded.plan_label,
  updated_at = excluded.updated_at;

-- ── 2) Baris awal payload cloud (opsional, kosong) ────────────────────────
insert into public.sigaji_cloud (tenant_key, payload, updated_at)
values ('__TENANT_KEY__', '{}'::jsonb, now())
on conflict (tenant_key) do nothing;

-- Butuh unique index tenant_key: sql/supabase_migrate_to_shared_payload.sql

-- ── 3) sigaji_cloud — RLS ─────────────────────────────────────────────────
drop policy if exists "sigaji_shared_select___TENANT_KEY__" on public.sigaji_cloud;
drop policy if exists "sigaji_shared_insert___TENANT_KEY__" on public.sigaji_cloud;
drop policy if exists "sigaji_shared_update___TENANT_KEY__" on public.sigaji_cloud;
drop policy if exists "sigaji_shared_delete___TENANT_KEY__" on public.sigaji_cloud;

create policy "sigaji_shared_select___TENANT_KEY__"
  on public.sigaji_cloud for select to authenticated
  using (tenant_key = '__TENANT_KEY__');

create policy "sigaji_shared_insert___TENANT_KEY__"
  on public.sigaji_cloud for insert to authenticated
  with check (tenant_key = '__TENANT_KEY__');

create policy "sigaji_shared_update___TENANT_KEY__"
  on public.sigaji_cloud for update to authenticated
  using (tenant_key = '__TENANT_KEY__')
  with check (tenant_key = '__TENANT_KEY__');

create policy "sigaji_shared_delete___TENANT_KEY__"
  on public.sigaji_cloud for delete to authenticated
  using (tenant_key = '__TENANT_KEY__');

-- ── 4) Tabel v11 — RLS ─────────────────────────────────────────────────────
drop policy if exists "sigaji_tenant_meta___TENANT_KEY__" on public.sigaji_tenant_meta;
create policy "sigaji_tenant_meta___TENANT_KEY__" on public.sigaji_tenant_meta for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_karyawan___TENANT_KEY__" on public.sigaji_karyawan;
create policy "sigaji_karyawan___TENANT_KEY__" on public.sigaji_karyawan for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_periode___TENANT_KEY__" on public.sigaji_periode;
create policy "sigaji_periode___TENANT_KEY__" on public.sigaji_periode for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_tunj_var_kolom___TENANT_KEY__" on public.sigaji_tunj_var_kolom;
create policy "sigaji_tunj_var_kolom___TENANT_KEY__" on public.sigaji_tunj_var_kolom for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_tunj_var_nilai___TENANT_KEY__" on public.sigaji_tunj_var_nilai;
create policy "sigaji_tunj_var_nilai___TENANT_KEY__" on public.sigaji_tunj_var_nilai for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_store___TENANT_KEY__" on public.sigaji_store;
create policy "sigaji_store___TENANT_KEY__" on public.sigaji_store for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

-- ── 5–8) Opsional — jika ERROR "relation does not exist", lewati blok itu
--        (tabel belum dibuat; jalankan skrip opsional di sql/README.md dulu)

-- ── 5) Registrasi email (jika tabel ada) ───────────────────────────────────
drop policy if exists "read registration requests __TENANT_KEY__" on public.sigaji_registration_requests;
create policy "read registration requests __TENANT_KEY__"
  on public.sigaji_registration_requests for select to authenticated
  using (tenant_key = '__TENANT_KEY__');

drop policy if exists "anon insert registration __TENANT_KEY__" on public.sigaji_registration_requests;
create policy "anon insert registration __TENANT_KEY__"
  on public.sigaji_registration_requests for insert to anon
  with check (
    tenant_key = '__TENANT_KEY__'
    and status = 'pending'
    and email is not null
    and length(trim(email)) > 3
  );

-- ── 6) Telegram (jika tabel ada) ───────────────────────────────────────────
drop policy if exists "read telegram links __TENANT_KEY__" on public.sigaji_telegram_links;
create policy "read telegram links __TENANT_KEY__"
  on public.sigaji_telegram_links for select to authenticated
  using (tenant_key = '__TENANT_KEY__');

drop policy if exists "read telegram requests __TENANT_KEY__" on public.sigaji_telegram_link_requests;
create policy "read telegram requests __TENANT_KEY__"
  on public.sigaji_telegram_link_requests for select to authenticated
  using (tenant_key = '__TENANT_KEY__');

-- ── 7) Riwayat slip email (jika tabel ada) ─────────────────────────────────
drop policy if exists "sigaji_slip_email_sent_select___TENANT_KEY__" on public.sigaji_slip_email_sent;
create policy "sigaji_slip_email_sent_select___TENANT_KEY__"
  on public.sigaji_slip_email_sent for select to authenticated
  using (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_slip_email_sent_ins___TENANT_KEY__" on public.sigaji_slip_email_sent;
create policy "sigaji_slip_email_sent_ins___TENANT_KEY__"
  on public.sigaji_slip_email_sent for insert to authenticated
  with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_slip_email_sent_upd___TENANT_KEY__" on public.sigaji_slip_email_sent;
create policy "sigaji_slip_email_sent_upd___TENANT_KEY__"
  on public.sigaji_slip_email_sent for update to authenticated
  using (tenant_key = '__TENANT_KEY__')
  with check (tenant_key = '__TENANT_KEY__');

-- ── 8) Riwayat slip Telegram (jika tabel ada) ──────────────────────────────
drop policy if exists "sigaji_slip_tg_sent_select___TENANT_KEY__" on public.sigaji_slip_tg_sent;
create policy "sigaji_slip_tg_sent_select___TENANT_KEY__"
  on public.sigaji_slip_tg_sent for select to authenticated
  using (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_slip_tg_sent_ins___TENANT_KEY__" on public.sigaji_slip_tg_sent;
create policy "sigaji_slip_tg_sent_ins___TENANT_KEY__"
  on public.sigaji_slip_tg_sent for insert to authenticated
  with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_slip_tg_sent_upd___TENANT_KEY__" on public.sigaji_slip_tg_sent;
create policy "sigaji_slip_tg_sent_upd___TENANT_KEY__"
  on public.sigaji_slip_tg_sent for update to authenticated
  using (tenant_key = '__TENANT_KEY__')
  with check (tenant_key = '__TENANT_KEY__');

-- ── 9) Mobile absensi & cuti (jika tabel ada — sql/supabase_sigaji_mobile_attendance.sql) ─
drop policy if exists "sigaji_work_locations___TENANT_KEY__" on public.sigaji_work_locations;
create policy "sigaji_work_locations___TENANT_KEY__" on public.sigaji_work_locations for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_location_assignments___TENANT_KEY__" on public.sigaji_location_assignments;
create policy "sigaji_location_assignments___TENANT_KEY__" on public.sigaji_location_assignments for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_attendance_logs___TENANT_KEY__" on public.sigaji_attendance_logs;
create policy "sigaji_attendance_logs___TENANT_KEY__" on public.sigaji_attendance_logs for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_leave_requests___TENANT_KEY__" on public.sigaji_leave_requests;
create policy "sigaji_leave_requests___TENANT_KEY__" on public.sigaji_leave_requests for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

drop policy if exists "sigaji_mobile_notifications___TENANT_KEY__" on public.sigaji_mobile_notifications;
create policy "sigaji_mobile_notifications___TENANT_KEY__" on public.sigaji_mobile_notifications for all to authenticated
  using (tenant_key = '__TENANT_KEY__') with check (tenant_key = '__TENANT_KEY__');

-- ── Verifikasi ─────────────────────────────────────────────────────────────
-- select tenant_key, max_employees, plan_label from public.sigaji_tenant_meta where tenant_key = '__TENANT_KEY__';
-- select policyname from pg_policies where policyname like '%__TENANT_KEY__%';
