-- Lindungi kuota lisensi: hanya penjual (service_role / Supabase dashboard / Netlify function)
-- yang boleh mengubah max_employees & plan_label. Admin perusahaan tidak bisa naikkan kuota sendiri.
-- Jalankan setelah supabase_tenant_license.sql

create or replace function public.sigaji_protect_tenant_license()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.max_employees := null;
    new.plan_label := null;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.max_employees := old.max_employees;
    new.plan_label := old.plan_label;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists sigaji_tenant_meta_protect_license on public.sigaji_tenant_meta;
create trigger sigaji_tenant_meta_protect_license
  before insert or update on public.sigaji_tenant_meta
  for each row
  execute function public.sigaji_protect_tenant_license();
