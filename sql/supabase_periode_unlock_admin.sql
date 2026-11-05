-- Hanya Admin yang boleh membuka kunci periode (snapshot_locked true → false).
-- Kunci (false → true) tetap boleh HRD kantor pusat. Jalankan di SQL Editor Supabase.
-- Aman diulang.

create or replace function public.sigaji_data_locked(d jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(
    case jsonb_typeof(d -> 'snapshot_locked')
      when 'boolean' then (d -> 'snapshot_locked') = 'true'::jsonb
      when 'string' then lower(d ->> 'snapshot_locked') in ('true', 't', '1')
      else false
    end,
    false
  );
$$;

create or replace function public.sigaji_periode_guard_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and public.sigaji_data_locked(old.data)
     and not public.sigaji_data_locked(new.data) then
    if auth.uid() is null then
      return new;
    end if;
    if not exists (
      select 1
      from public.sigaji_user_roles r
      where r.auth_uid = auth.uid()
        and r.tenant_key = new.tenant_key
        and r.aktif
        and r.role = 'Admin'
    ) then
      raise exception 'Hanya Admin yang dapat membuka kunci periode'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sigaji_periode_guard_unlock on public.sigaji_periode;
create trigger sigaji_periode_guard_unlock
  before update on public.sigaji_periode
  for each row execute function public.sigaji_periode_guard_unlock();

grant execute on function public.sigaji_data_locked(jsonb) to authenticated, service_role;
