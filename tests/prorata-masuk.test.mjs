/**
 * Pro-rata karyawan baru: HH = hari kerja sejak tanggal masuk, bukan jumlah absensi tersimpan.
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore({
  perusahaan: { hariKerja: 6 },
  hariLibur: [],
  periodes: [
    {
      id: 1,
      nama: 'Oktober 2026',
      start: '2026-10-01',
      end: '2026-10-31',
      bayar: '2026-10-31',
      status: 'aktif',
    },
  ],
});

const p = px.periodes[0];
const baru = { nik: 'MASUK-05', nama: 'Masuk 5 Okt', masuk: '2026-10-05' };
const penuh = { nik: 'LAMA', nama: 'Sudah lama', masuk: '2024-01-02' };
const resign = { nik: 'RES', nama: 'Resign', masuk: '2026-10-05', tgl_berhenti: '2026-10-20' };

const a = px.prorataHkHhOtomatis(baru, p);
const b = px.prorataHkHhOtomatis(penuh, p);
const c = px.prorataHkHhOtomatis(resign, p);

assertEq('HK Oktober 6 hari kerja', a.hk, 27);
assertEq('HH sejak 5 Oktober', a.hh, 24);
assertEq('karyawan lama HH = HK', b.hh, b.hk);
assertEq('resign memotong HH setelah tanggal masuk', c.hh < a.hh && c.hh > 0, true);
assertEq('manual HH tidak ditimpa', (function () {
  px.karyawan = [baru];
  px.prorata['MASUK-05'] = { 'Oktober 2026': { enabled: true, hk: 27, hh: 10, manual: true } };
  var pr = px.sigajiRefreshProrataOtomatis('MASUK-05', 'Oktober 2026');
  return pr.hh;
})(), 10);

console.log('\nProrata masuk: semua tes lulus.');
