-- SiGaji — satu akun Telegram (chat_id) hanya untuk satu NIK per perusahaan.
-- Jalankan di SQL Editor (aman diulang). Prasyarat: sql/supabase_sigaji_telegram.sql.

delete from public.sigaji_telegram_links a
using public.sigaji_telegram_links b
where a.tenant_key = b.tenant_key
  and a.chat_id = b.chat_id
  and a.ctid <> b.ctid
  and (
    a.linked_at < b.linked_at
    or (a.linked_at = b.linked_at and a.nik < b.nik)
  );

create unique index if not exists sigaji_telegram_links_chat_uidx
  on public.sigaji_telegram_links (tenant_key, chat_id);
