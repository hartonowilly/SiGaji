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

px.karyawan = [baru, penuh];
px.prorata = {};
px.syncProrataDariMasuk(baru);
assertEq('masuk tengah bulan: pro-rata nyala', px.getPR(baru.nik, p.nama).enabled, true);
assertEq('masuk tengah bulan: HH < HK', px.getPR(baru.nik, p.nama).hh < px.getPR(baru.nik, p.nama).hk, true);
px.syncProrataDariMasuk(penuh);
assertEq('karyawan lama: pro-rata tetap mati', px.getPR(penuh.nik, p.nama).enabled, false);

px.prorata[baru.nik][p.nama].enabled = false;
px.prorata[baru.nik][p.nama].masukPrOff = true;
px.syncProrataDariMasuk(baru);
assertEq('user matikan: tidak dinyalakan ulang', px.getPR(baru.nik, p.nama).enabled, false);

px.prorata = {};
px.ensureProrataMasukUntukPeriode(baru, p);
assertEq('ensure periode aktif menyalakan joiner', px.getPR(baru.nik, p.nama).enabled, true);

const hariPertama = { nik: 'DAY1', nama: 'Masuk 1 Okt', masuk: '2026-10-01' };
px.prorata = {};
px.syncProrataDariMasuk(hariPertama);
assertEq('masuk tanggal 1: tidak auto pro-rata', px.getPR(hariPertama.nik, p.nama).enabled, false);

console.log('\nProrata masuk: semua tes lulus.');
