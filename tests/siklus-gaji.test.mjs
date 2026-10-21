/**
 * Tes tipe gaji harian / mingguan / bulanan.
 * Tarif dikonversi ke total sebulan; PPh 21 & BPJS dari total itu.
 * Data fiktif — tanpa database.
 *
 * Jalankan: node tests/siklus-gaji.test.mjs
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const PERIODE = 'Maret 2026';
const bpjsOff = {
  'kes-prs': false,
  'kes-kar': false,
  'jht-prs': false,
  'jht-kar': false,
  'jp-prs': false,
  'jp-kar': false,
  'jkk-prs': false,
  'jkm-prs': false,
};

function karBase(extra) {
  return {
    nik: 'TES-SIKLUS',
    nama: 'Karyawan Uji Siklus (fiktif)',
    gapok: 0,
    ptkp: 'TK0',
    masuk: '2020-01-01',
    tunjangan: [],
    potongan: [],
    natura: [],
    bpjs_aktif: bpjsOff,
    ...extra,
  };
}

{
  const px = loadPayrollCore();
  assertEq('default kosong = bulanan', px.normalizeSiklusGaji(undefined), 'bulanan');
  assertEq('legacy 2 mingguan → mingguan', px.normalizeSiklusGaji('2 mingguan'), 'mingguan');
  assertEq('alias weekly', px.normalizeSiklusGaji('weekly'), 'mingguan');
  const days = px.siklusHariKalender('2026-02-25', '2026-03-24');
  assertEq('periode harness 28 hari', days, 28);
  assertEq('28 hari = 4 minggu', px.siklusUnitPeriode('mingguan', { start: '2026-02-25', end: '2026-03-24' }), 4);
  assertEq('sort rank bulanan', px.sigajiSiklusGajiSortRank('bulanan'), 0);
  assertEq('sort rank mingguan', px.sigajiSiklusGajiSortRank('mingguan'), 1);
  assertEq('sort rank harian', px.sigajiSiklusGajiSortRank('harian'), 2);
  const urut = [
    { nik: 'K0002', siklus_gaji: 'harian' },
    { nik: 'NT0001', siklus_gaji: 'mingguan' },
    { nik: 'K0001', siklus_gaji: 'bulanan' },
    { nik: 'K0003', siklus_gaji: 'mingguan' },
  ].sort(function (a, b) {
    var d = px.sigajiSiklusGajiSortRank(a.siklus_gaji) - px.sigajiSiklusGajiSortRank(b.siklus_gaji);
    return d || String(a.nik).localeCompare(String(b.nik), 'id', { numeric: true });
  });
  assertEq('urut tetap+tidak tetap: bulanan, mingguan, harian', urut.map(function (x) { return x.nik; }).join(','), 'K0001,K0003,NT0001,K0002');
}

{
  const px = loadPayrollCore();
  const k = karBase({ gapok: 8_000_000, siklus_gaji: 'bulanan' });
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  assertEq('bulanan gapokEff = tarif', g.gapokEff, 8_000_000);
  assertEq('bulanan siklus', g.siklusGaji, 'bulanan');
}

{
  const px = loadPayrollCore();
  const k = karBase({ nik: 'TES-HR', gapok: 200_000, siklus_gaji: 'harian' });
  const hk = px.hariKerjaRange('2026-02-25', '2026-03-24');
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  assert('hari kerja periode > 0', hk > 0);
  assertEq('harian gapokEff = tarif × hari kerja (absensi kosong = hadir)', g.gapokEff, 200_000 * hk);
  assertEq('harian units = hari kerja', g.siklusUnits, hk);
  assertEq('harian PPh dari total sebulan (bukan tarif harian)', g.grossPPh, g.gapokEff);
  assertEq('harian tanpa potongan kehadiran ganda', g.potKehadiran.total, 0);
}

{
  const px = loadPayrollCore();
  const k = karBase({ nik: 'TES-HR2', gapok: 200_000, siklus_gaji: 'harian' });
  const hk = px.hariKerjaRange('2026-02-25', '2026-03-24');
  px.absensi['TES-HR2'] = { '2026-03-02': 'alpha' };
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  const expected = 200_000 * (hk - 1);
  assertEq('harian alpha 1 hari = tidak dibayar hari itu', g.gapokEff, expected);
  assertEq('harian tidak dipotong lagi karena alpha', g.potKehadiran.total, 0);
}

{
  const px = loadPayrollCore();
  const k = karBase({ nik: 'TES-MG', gapok: 1_500_000, siklus_gaji: 'mingguan' });
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  assertEq('mingguan 4 minggu', g.gapokEff, 6_000_000);
  assertEq('mingguan units', g.siklusUnits, 4);
  assertEq('mingguan gross = total sebulan', g.grossPPh, 6_000_000);
}

{
  const px = loadPayrollCore();
  const k = karBase({
    nik: 'TES-MG-PR',
    gapok: 1_500_000,
    siklus_gaji: 'mingguan',
  });
  px.prorata['TES-MG-PR'] = {
    [PERIODE]: { enabled: true, hk: 22, hh: 11, manual: true },
  };
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  assertEq('mingguan × prorata 11/22', g.gapokEff, 3_000_000);
}

{
  const px = loadPayrollCore();
  const k = karBase({
    nik: 'TES-HR-PR',
    gapok: 200_000,
    siklus_gaji: 'harian',
  });
  const hk = px.hariKerjaRange('2026-02-25', '2026-03-24');
  px.prorata['TES-HR-PR'] = {
    [PERIODE]: { enabled: true, hk: 22, hh: 11, manual: true },
  };
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  assertEq('harian tidak dikali prorata lagi', g.gapokEff, 200_000 * hk);
}

{
  const px = loadPayrollCore({
    karyawan: [
      karBase({
        nik: 'TES-BPJS',
        gapok: 1_500_000,
        siklus_gaji: 'mingguan',
        bpjs_aktif: {
          'kes-prs': true,
          'kes-kar': true,
          'jht-prs': false,
          'jht-kar': false,
          'jp-prs': false,
          'jp-kar': false,
          'jkk-prs': false,
          'jkm-prs': false,
        },
      }),
    ],
  });
  const k = px.karyawan[0];
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  assertEq('PPh upah = 4 Jumat × tarif (periode 28 hari)', g.gapokEff, 6_000_000);
  const basisBpjs = px.siklusBpjsUpahSebulan('mingguan', 1_500_000, 6);
  assertEq('dasar BPJS = 1,5jt/6 × 25', basisBpjs, 6_250_000);
  assert('BPJS kes karyawan > 0 dari dasar ×25', g.bpjs.kes_kar > 0);
  const monthly = px.calcBPJS(k, basisBpjs, 0);
  assertEq('BPJS kes = calc dari 6,25jt bukan 6jt', g.bpjs.kes_kar, monthly.kes_kar);
  const weeklyWrong = px.calcBPJS(k, 1_500_000, 0);
  assert('bukan BPJS dari tarif mingguan', g.bpjs.kes_kar !== weeklyWrong.kes_kar);
  const fromPays = px.calcBPJS(k, 6_000_000, 0);
  assert('bukan BPJS dari jumlah Jumat', g.bpjs.kes_kar !== fromPays.kes_kar);
}

console.log('\nSemua tes siklus gaji lulus.');
