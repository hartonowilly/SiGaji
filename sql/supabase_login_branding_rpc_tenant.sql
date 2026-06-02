-- =============================================================================
-- Branding login per tenant_key (bukan hardcode 'main' saja).
-- Jalankan SEKALI di Supabase SQL Editor (semua deploy hosted).
-- App memanggil: rpc('sigaji_get_login_branding', { p_tenant_key: '...' })
-- =============================================================================

drop function if exists public.sigaji_get_login_branding();

create or replace function public.sigaji_get_login_branding(p_tenant_key text default 'main')
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
      where s.tenant_key = coalesce(nullif(trim(p_tenant_key), ''), 'main')
        and s.store_key = 'perusahaan'
      limit 1
    ),
    (
      select c.payload -> 'perusahaan'
      from public.sigaji_cloud c
      where c.tenant_key = coalesce(nullif(trim(p_tenant_key), ''), 'main')
      limit 1
    ),
    '{}'::jsonb
  );
$$;

revoke all on function public.sigaji_get_login_branding(text) from public;
grant execute on function public.sigaji_get_login_branding(text) to anon, authenticated, service_role;
