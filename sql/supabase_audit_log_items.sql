-- SiGaji — pecah dokumen auditLog (sigaji_store) jadi satu baris sigaji_item per entri.
-- Simpan absensi cepat lalu hanya INSERT entri baru, bukan menulis ulang ~3000 jejak.
-- Jalankan di SQL Editor Supabase (aman diulang). Prasyarat: SQL v12.

alter table public.sigaji_item drop constraint if exists sigaji_item_kind_check;
alter table public.sigaji_item add constraint sigaji_item_kind_check
  check (kind in (
    'absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot',
    'hasilGaji', 'absensiPotBaseline', 'auditLog'
  ));

insert into public.sigaji_item (tenant_key, kind, item_key, nik, data)
select s.tenant_key,
       'auditLog',
       coalesce(
         nullif(replace(btrim(e ->> 'id'), '|', '_'), ''),
         'h' || substr(md5(s.tenant_key || e::text), 1, 16)
       ),
       coalesce(e ->> 'nik', ''),
       case
         when e ? 'id' and btrim(coalesce(e ->> 'id', '')) <> '' then e
         else e || jsonb_build_object(
           'id',
           coalesce(
             nullif(replace(btrim(e ->> 'id'), '|', '_'), ''),
             'h' || substr(md5(s.tenant_key || e::text), 1, 16)
           )
         )
       end
from public.sigaji_store s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.data) = 'array' then s.data else '[]'::jsonb end
) e
where s.store_key = 'auditLog'
  and jsonb_typeof(e) = 'object'
on conflict do nothing;

update public.sigaji_store
set data = '[]'::jsonb
where store_key = 'auditLog'
  and jsonb_typeof(data) = 'array'
  and jsonb_array_length(data) > 0;
