/**
 * Lembur hanya tanggal di periode aktif; hari Minggu/libur pakai tarif 2× (PP 35/2021).
 * Gapok uji Rp5.190.000 → upah/jam = 5.190.000 / 173 = 30.000.
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const pMaret = {
  id: 1,
  nama: 'Maret 2026',
  start: '2026-03-01',
  end: '2026-03-31',
  bayar: '2026-03-31',
  status: 'aktif',
};

const k = {
  nik: 'LB-01',
  nama: 'Uji Lembur',
  gapok: 5_190_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: {},
};

function hitungLb(entries) {
  const px = loadPayrollCore({
    perusahaan: { hariKerja: 6 },
    periodes: [pMaret],
    karyawan: [k],
    lembur: { 'LB-01': entries },
    hariLibur: [],
  });
  return px.hitungGaji(k, pMaret.nama).lb;
}

assertEq('upah per jam 5190000/173', Math.round(5_190_000 / 173), 30_000);
assertEq('Selasa 2 jam = 105.000', hitungLb([{ tanggal: '2026-03-03', jam: 2 }]), 105_000);
assertEq(
  'entri Februari tidak dibayar di Maret',
  hitungLb([
    { tanggal: '2026-03-03', jam: 2 },
    { tanggal: '2026-02-10', jam: 2 },
  ]),
  105_000
);
assertEq('Minggu 2 jam = 120.000', hitungLb([{ tanggal: '2026-03-01', jam: 2 }]), 120_000);
assertEq('tanpa tanggal tidak dibayar', hitungLb([{ tanggal: '', jam: 2 }]), 0);

const pxLibur = loadPayrollCore({
  perusahaan: { hariKerja: 6 },
  periodes: [pMaret],
  karyawan: [k],
  hariLibur: [{ tgl: '2026-03-10', nama: 'Libur uji', tipe: 'nasional' }],
  lembur: { 'LB-01': [{ tanggal: '2026-03-10', jam: 2 }] },
});
assertEq('libur nasional Selasa 2 jam = 120.000', pxLibur.hitungGaji(k, pMaret.nama).lb, 120_000);

console.log('\nLembur periode: semua tes lulus.');
