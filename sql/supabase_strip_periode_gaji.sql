-- =============================================================================
-- SiGaji — pindahkan gaji beku ke sigaji_item, lalu hapus dari JSON periode.
-- Jalankan di SQL Editor (aman diulang). Jangan pakai skrip lama yang hanya
-- menghapus hasil_gaji tanpa INSERT — itu membuang slip terkunci.
-- =============================================================================

alter table public.sigaji_item drop constraint if exists sigaji_item_kind_check;
alter table public.sigaji_item add constraint sigaji_item_kind_check
  check (kind in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot', 'hasilGaji', 'absensiPotBaseline', 'auditLog'));

insert into public.sigaji_item (tenant_key, kind, item_key, nik, data)
select p.tenant_key,
       'hasilGaji',
       p.nama || '|' || n.key,
       n.key,
       n.value
from public.sigaji_periode p
cross join lateral jsonb_each(coalesce(p.data -> 'hasil_gaji' -> 'byNik', '{}'::jsonb)) n
where jsonb_typeof(p.data -> 'hasil_gaji' -> 'byNik') = 'object'
  and n.value is not null
  and n.value <> 'null'::jsonb
on conflict do nothing;

insert into public.sigaji_item (tenant_key, kind, item_key, nik, data)
select p.tenant_key,
       'absensiPotBaseline',
       p.nama || '|' || n.key,
       n.key,
       n.value
from public.sigaji_periode p
cross join lateral jsonb_each(coalesce(p.data -> 'absensi_pot_baseline', '{}'::jsonb)) n
where jsonb_typeof(p.data -> 'absensi_pot_baseline') = 'object'
  and n.value is not null
  and n.value <> 'null'::jsonb
on conflict do nothing;

update public.sigaji_periode
set data = data - 'hasil_gaji' - 'absensi_pot_baseline'
where jsonb_typeof(data) = 'object'
  and (data ? 'hasil_gaji' or data ? 'absensi_pot_baseline');
