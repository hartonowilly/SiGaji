-- Perbaikan manual: riwayat kirim slip Telegram (period_nama salah)
-- =================================================================
-- Bug lama: beberapa kiriman tersimpan dengan period_nama = periode
-- aktif (mis. Mei) padahal dropdown memilih bulan lain. Setelah patch
-- app, kiriman baru sudah benar — baris LAMA tidak berubah sendiri.
--
-- Cara pakai (Supabase → SQL Editor):
-- 1) Jalankan bagian SELECT di bawah, cek baris yang period_nama-nya
--    tidak sesuai kenyataan kiriman Anda.
-- 2) Pilih salah satu strategi:
--    A) HAPUS baris salah → di app kolom Slip jadi "Belum" untuk
--       kombinasi itu; kirim lagi dari SiGaji jika perlu tercatat.
--    B) Jangan ubah jika Anda tidak peduli riwayat; biarkan saja.
--
-- Catatan: primary key = (tenant_key, nik, period_nama, slip_type).
-- Mengganti period_nama = UPDATE yang mengubah kunci; lebih mudah
-- DELETE lalu kirim ulang dari aplikasi.

-- ── 1) Lihat semua riwayat (sesuaikan tenant_key jika bukan 'main') ──
select tenant_key, nik, period_nama, slip_type, sent_at
from public.sigaji_slip_tg_sent
where tenant_key = 'main'
order by sent_at desc;

-- ── 2a) Hapus SEMUA riwayat untuk satu period_nama yang salah ───────
-- Contoh: Anda yakin tidak ada kiriman sah ke "Mei 2026" lewat bug itu,
-- dan ingin mengosongkan status slip untuk Mei agar tidak "Terkirim" palsu.
-- Hapus komentar (-- ) lalu jalankan SETELAH menyesuaikan nilai string.

-- delete from public.sigaji_slip_tg_sent
-- where tenant_key = 'main'
--   and period_nama = 'Mei 2026';

-- ── 2b) Hapus satu baris (satu karyawan + periode + jenis slip) ───────
-- delete from public.sigaji_slip_tg_sent
-- where tenant_key = 'main'
--   and nik = 'GANTI_NIK'
--   and period_nama = 'Mei 2026'
--   and slip_type = 'gaji';

-- ── 2c) Hapus semua baris tenant (reset penuh riwayat kirim slip) ────
-- Hati-hati: semua status "sudah terkirim" hilang untuk tenant ini.

-- delete from public.sigaji_slip_tg_sent
-- where tenant_key = 'main';
