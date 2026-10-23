/**
 * Ukur waktu hitungGaji() dengan data fiktif berukuran perusahaan besar.
 * Jalankan: node scripts/bench-hitung-gaji.mjs [jumlahKaryawan=500] [jumlahBulan=36]
 */
import { loadPayrollCore } from '../tests/lib/payroll-harness.mjs';

const N = parseInt(process.argv[2], 10) || 500;
const MONTHS = parseInt(process.argv[3], 10) || 36;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const periodes = [];
const first = new Date(2026 - Math.ceil(MONTHS / 12) + 1, 0, 1);
for (let i = 0; i < MONTHS; i++) {
  const s = new Date(first.getFullYear(), first.getMonth() + i - 1, 25);
  const e = new Date(first.getFullYear(), first.getMonth() + i, 24);
  periodes.push({
    id: i + 1,
    nama: NAMA[e.getMonth()] + ' ' + e.getFullYear(),
    start: iso(s),
    end: iso(e),
    bayar: iso(new Date(e.getFullYear(), e.getMonth(), 25)),
    status: i === MONTHS - 1 ? 'aktif' : 'tutup',
    tipe_periode: e.getMonth() === 11 ? 'desember' : 'normal',
    snapshot_locked: i < MONTHS - 1,
  });
}

const STATUS = ['hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'izin', 'sakit', 'alpha', 'cuti'];
const karyawan = [];
const absensi = {};
const lembur = {};
const karSnapshot = {};
for (let i = 0; i < N; i++) {
  const nik = 'B' + String(i + 1).padStart(4, '0');
  const k = {
    nik,
    nama: 'Karyawan ' + i,
    gapok: 4_000_000 + (i % 40) * 150_000,
    ptkp: ['TK0', 'K0', 'K1', 'K2'][i % 4],
    masuk: '2019-01-01',
    tunjangan: [
      { nama: 'Transport', nilai: 300_000, tipe: 'tetap' },
      { nama: 'Makan', nilai: 25_000, tipe: 'harian' },
    ],
    potongan: [{ nama: 'Koperasi', nilai: 50_000 }],
    natura: [],
    bpjs_aktif: { 'kes-prs': true, 'kes-kar': true, 'jht-prs': true, 'jht-kar': true, 'jp-prs': true, 'jp-kar': true, 'jkk-prs': true, 'jkm-prs': true },
  };
  karyawan.push(k);
  absensi[nik] = {};
  periodes.forEach((p, pi) => {
    for (let d = new Date(p.start); iso(d) <= p.end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) continue;
      absensi[nik][iso(d)] = STATUS[(i + pi + d.getDate()) % STATUS.length];
    }
    (karSnapshot[p.nama] = karSnapshot[p.nama] || {})[nik] = JSON.parse(JSON.stringify(k));
    // Seperti di produksi: kunci periode menyimpan baseline potongan absensi (dipakai koreksi bulan berikutnya).
    if (p.snapshot_locked) (p.absensi_pot_baseline = p.absensi_pot_baseline || {})[nik] = { total: 0, details: [] };
    // Seperti di produksi: kunci periode menyimpan baseline potongan absensi (dipakai koreksi bulan berikutnya).
    if (p.snapshot_locked) (p.absensi_pot_baseline = p.absensi_pot_baseline || {})[nik] = { total: 0, details: [] };
  });
  lembur[nik] = periodes.map((p) => ({ tanggal: p.end, jam: 2 }));
}

const px = loadPayrollCore({ periodes, karyawan, absensi, lembur, karSnapshot, masterCuti: { cbPotong: true, kuota: 12 } });

function time(label, fn) {
  const t0 = performance.now();
  const n = fn();
  const ms = performance.now() - t0;
  console.log(label.padEnd(58) + Math.round(ms).toString().padStart(7) + ' ms' + (n ? '  (' + n + ' hitung)' : ''));
  return ms;
}

console.log(N + ' karyawan, ' + MONTHS + ' periode bulanan, absensi harian lengkap\n');
const aktif = periodes.filter((p) => p.tipe_periode !== 'desember').pop();
const des = periodes.filter((p) => p.tipe_periode === 'desember').pop();
time('Penggajian 1 periode biasa (semua karyawan)', () => {
  karyawan.forEach((k) => px.hitungGaji(k, aktif.nama));
  return N;
});
time('Periode Desember (rekonsiliasi PPh setahun)', () => {
  karyawan.forEach((k) => px.hitungGaji(k, des.nama));
  return N;
});
time('Laporan rekap: semua periode x semua karyawan', () => {
  px.sigajiWithHitungCache(() => periodes.forEach((p) => karyawan.forEach((k) => px.hitungGaji(k, p.nama))));
  return N * MONTHS;
});
time('Laporan rekap dengan ringkasan arsip (hanya periode aktif)', () => {
  karyawan.forEach((k) => px.hitungGaji(k, aktif.nama));
  return N;
});
