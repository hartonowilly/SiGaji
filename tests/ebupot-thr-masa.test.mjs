/**
 * THR dilaporkan di e-Bupot pada bulan dibayar, bukan bulan gaji.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEbupotExport } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}
function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const bpjsOff = {
  'kes-prs': false, 'kes-kar': false, 'jht-prs': false, 'jht-kar': false,
  'jp-prs': false, 'jp-kar': false, 'jkk-prs': false, 'jkm-prs': false,
};

const periodes = [
  {
    id: 1, nama: 'Februari 2027', start: '2027-02-01', end: '2027-02-28',
    bayar: '2027-03-05', status: 'tutup', thr_aktif: false,
  },
  {
    id: 2, nama: 'Maret 2027', start: '2027-03-01', end: '2027-03-31',
    bayar: '2027-04-05', status: 'aktif', thr_aktif: true,
    thr_nama: 'Lebaran', thr_bayar: '2027-03-03',
  },
];

const kar = {
  nik: 'THR-1', nama: 'Sari', gapok: 8_000_000, ptkp: 'TK0', masuk: '2020-01-01',
  tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff, tipe_kerja: 'tetap',
  npwp: '1234567890123456',
};

const px = loadEbupotExport({ periodes: periodes, karyawan: [kar] });
const gMar = px.hitungGaji(kar, 'Maret 2027');
assert('periode Maret ada THR', gMar.thrBruto > 0);
assertEq('grossPPh = gaji + THR', gMar.grossPPh, gMar.grossPPhRegular + gMar.thrBruto);

const april = px.ebupotBuildRows(periodes[1]);
assert('export periode Maret = masa April (tgl bayar gaji)', april.ok && april.masa.yyyymm === '202704');
assertEq('April bruto tanpa THR', april.rows[0].penghasilanBruto, Math.round(gMar.grossPPhRegular));
assertEq('April tidak memuat THR', april.rows[0].thrBruto, 0);
assertEq('April PPh tanpa porsi THR', april.rows[0].pphDipotong, Math.round(gMar.pphTanpaThr));
assert(
  'peringatan THR pindah ke Maret',
  april.warnings.some(function (w) { return String(w).indexOf('THR') >= 0 && String(w).indexOf('Maret') >= 0; })
);

const maret = px.ebupotBuildRows(periodes[0]);
assert('export Februari = masa Maret', maret.ok && maret.masa.yyyymm === '202703');
const rowMar = maret.rows[0];
assert('Maret memuat THR', rowMar.thrBruto === Math.round(gMar.thrBruto));
assertEq(
  'Maret bruto = gaji Feb + THR',
  rowMar.penghasilanBruto,
  Math.round(px.hitungGaji(kar, 'Februari 2027').grossPPhRegular + gMar.thrBruto)
);
assertEq('Maret PPh termasuk porsi THR', rowMar.pphDipotong, Math.round(px.hitungGaji(kar, 'Februari 2027').pphTanpaThr + gMar.pphAtasThr));

assertEq('sama bulan: THR ikut gaji', px.ebupotMasaThrFromPeriode({
  thr_aktif: true, thr_bayar: '2027-04-05', bayar: '2027-04-05',
}).yyyymm, '202704');

const firstOnly = [
  {
    id: 1, nama: 'Maret 2027', start: '2027-03-01', end: '2027-03-31',
    bayar: '2027-04-05', status: 'aktif', thr_aktif: true,
    thr_nama: 'Lebaran', thr_bayar: '2027-03-03',
  },
];
const px0 = loadEbupotExport({ periodes: firstOnly, karyawan: [kar] });
const yatim = px0.ebupotThrYatim(firstOnly[0]);
assertEq('bulan pertama: THR yatim Maret', yatim && yatim.yyyymm, '202703');
const pack0 = px0.ebupotDaftarBuiltMasa(firstOnly[0]);
assert('bulan pertama: dua masa diekspor', pack0.ok && pack0.list.length === 2);
assertEq('file pertama masa THR Maret', pack0.list[0].masa.yyyymm, '202703');
assert('file Maret memuat THR', pack0.list[0].rows[0].thrBruto > 0);
assertEq('file kedua masa gaji April', pack0.list[1].masa.yyyymm, '202704');
assertEq('file April tanpa THR', pack0.list[1].rows[0].thrBruto, 0);
const marOnly = px0.ebupotBuildRows(firstOnly[0], { masaYyyymm: '202703' });
assert('buildRows masa 202703 ok', marOnly.ok && marOnly.rows[0].thrBruto > 0);
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js/modules/ebupot-export.js'), 'utf8');
assert('toast dua file THR', src.indexOf('2 file: masa THR dan masa gaji') >= 0);

console.log('ebupot-thr-masa.test.mjs: all passed');
