-- =============================================================================
-- Branding halaman login (nama PT + logo) — bisa dibaca SEBELUM login
-- Jalankan sekali di Supabase SQL Editor.
-- Hanya mengembalikan objek perusahaan (nama, logo), bukan seluruh database.
-- =============================================================================

create or replace function public.sigaji_get_login_branding()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.data
      from public.sigaji_store s
      where s.tenant_key = 'main'
        and s.store_key = 'perusahaan'
      limit 1
    ),
    (
      select c.payload -> 'perusahaan'
      from public.sigaji_cloud c
      where c.tenant_key = 'main'
      limit 1
    ),
    '{}'::jsonb
  );
$$;

revoke all on function public.sigaji_get_login_branding() from public;
grant execute on function public.sigaji_get_login_branding() to anon, authenticated, service_role;
