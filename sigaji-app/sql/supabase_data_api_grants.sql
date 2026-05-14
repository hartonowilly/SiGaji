-- SiGaji — GRANT eksplisit untuk Data API (PostgREST / supabase-js)
-- ---------------------------------------------------------------
-- Supabase (2026+): proyek baru (dari 30 Mei 2026) dan nanti semua proyek
-- (dari 30 Okt 2026) dapat mewajibkan GRANT eksplisit pada tabel `public`
-- agar role anon/authenticated/service_role bisa mengakses lewat REST.
-- Tanpa GRANT, klien bisa mendapat error 42501 (PostgREST menyertakan hint).
--
-- SiGaji memakai supabase-js dari browser (authenticated) dan Netlify Functions
-- memakai service_role. Jalankan skrip ini SETELAH migrasi SQL SiGaji Anda ada.
-- RLS tetap berlaku; GRANT hanya memberi hak per role PostgreSQL.
--
-- Sesuaikan daftar tabel jika Anda menambah tabel lain di public.

grant usage on schema public to anon, authenticated, service_role;

-- Browser (user login): sinkron cloud, Telegram, riwayat slip
grant select, insert, update, delete on table public.sigaji_cloud to authenticated;
grant select, insert, update, delete on table public.sigaji_telegram_links to authenticated;
grant select, insert, update, delete on table public.sigaji_telegram_link_requests to authenticated;
grant select, insert, update, delete on table public.sigaji_slip_tg_sent to authenticated;

-- Registrasi email: baca policy terbatas; insert/update lewat Functions (service_role)
grant select on table public.sigaji_registration_requests to authenticated;

-- Netlify Functions (service_role) — konsisten dengan kebijakan Supabase baru
grant select, insert, update, delete on table public.sigaji_cloud to service_role;
grant select, insert, update, delete on table public.sigaji_telegram_links to service_role;
grant select, insert, update, delete on table public.sigaji_telegram_link_requests to service_role;
grant select, insert, update, delete on table public.sigaji_slip_tg_sent to service_role;
grant select, insert, update, delete on table public.sigaji_registration_requests to service_role;
