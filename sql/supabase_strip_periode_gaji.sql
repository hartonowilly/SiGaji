-- =============================================================================
-- SiGaji — hapus gaji per orang dari JSON periode + izinkan kind item baru.
-- Jalankan di SQL Editor (aman diulang) SETELAH deploy aplikasi yang memindah
-- hasil_gaji / absensi_pot_baseline ke sigaji_item.
-- =============================================================================

alter table public.sigaji_item drop constraint if exists sigaji_item_kind_check;
alter table public.sigaji_item add constraint sigaji_item_kind_check
  check (kind in ('absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot', 'hasilGaji', 'absensiPotBaseline'));

update public.sigaji_periode
set data = data - 'hasil_gaji' - 'absensi_pot_baseline'
where jsonb_typeof(data) = 'object'
  and (data ? 'hasil_gaji' or data ? 'absensi_pot_baseline');
