-- Izinkan form "Daftar Email" dari browser (anon) tanpa Netlify/Cloudflare Functions.
-- Jalankan sekali di Supabase SQL Editor setelah supabase_sigaji_registration.sql.

drop policy if exists "anon insert registration pending" on public.sigaji_registration_requests;
create policy "anon insert registration pending"
on public.sigaji_registration_requests for insert
to anon
with check (
  tenant_key = 'main'
  and status = 'pending'
  and email is not null
  and length(trim(email)) > 3
);
