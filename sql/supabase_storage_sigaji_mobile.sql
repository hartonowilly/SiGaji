-- =============================================================================
-- Storage bucket untuk foto absensi & surat cuti (PWA /mobile/ & app)
-- Jalankan di Supabase SQL Editor SETELAH bucket dibuat atau biarkan skrip ini buat.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sigaji-mobile',
  'sigaji-mobile',
  false,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Hapus policy lama jika ada (nama bisa beda di proyek lama)
drop policy if exists "sigaji_mobile_auth_insert" on storage.objects;
drop policy if exists "sigaji_mobile_auth_select" on storage.objects;
drop policy if exists "sigaji_mobile_auth_update" on storage.objects;
drop policy if exists "sigaji_mobile_auth_delete" on storage.objects;
drop policy if exists "sigaji_mobile_service_all" on storage.objects;

-- User login Supabase (role authenticated) boleh upload & baca file di bucket ini
create policy "sigaji_mobile_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'sigaji-mobile');

create policy "sigaji_mobile_auth_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'sigaji-mobile');

create policy "sigaji_mobile_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'sigaji-mobile')
  with check (bucket_id = 'sigaji-mobile');

create policy "sigaji_mobile_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'sigaji-mobile');

-- Verifikasi:
-- select id, name, public, file_size_limit from storage.buckets where id = 'sigaji-mobile';
-- select policyname from pg_policies where tablename = 'objects' and schemaname = 'storage';
