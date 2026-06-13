-- SiGaji — tambah role "Absen" (hanya APK Android, bukan web / PWA mobile browser)
-- Jalankan jika sudah pernah menjalankan supabase_sigaji_user_roles_rls.sql

alter table public.sigaji_user_roles
  drop constraint if exists sigaji_user_roles_role_check;

alter table public.sigaji_user_roles
  add constraint sigaji_user_roles_role_check
  check (role in ('Admin', 'HRD', 'Karyawan', 'Absen'));
