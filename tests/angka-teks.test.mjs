/**
 * Nilai rupiah yang tersimpan sebagai teks (impor Excel / backup lama) tidak boleh jadi gabung teks
 * ("0" + "500000") di hitungGaji — hasil harus sama persis dengan nilai angka.
 * Jalankan: node tests/angka-teks.test.mjs
 */
import vm from 'vm';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

const BPJS = { 'kes-prs': true, 'kes-kar': true, 'jht-prs': true, 'jht-kar': true, 'jp-prs': true, 'jp-kar': true, 'jkk-prs': true, 'jkm-prs': true };

function karyawan(asText) {
  const v = (n) => (asText ? String(n) : n);
  return {
    nik: 'TES-TEKS',
    nama: 'Teks Contoh (fiktif)',
    gapok: 8_000_000,
    ptkp: 'K1',
    masuk: '2020-01-01',
    tunjangan: [
      { nama: 'Transport', nilai: v(750_000), tipe: 'tetap', thr_ikut: true },
      { nama: 'Makan', nilai: asText ? '500.000' : 500_000, tipe: 'tidak_tetap' },
    ],
    potongan: [
      { nama: 'Koperasi', nilai: v(100_000) },
      { nama: 'Kasbon', nilai: asText ? '1.250.000' : 1_250_000 },
    ],
    natura: [
      { nama: 'Mess', nilai: v(300_000), kp: true },
      { nama: 'Seragam', nilai: v(150_000), kp: false },
    ],
    bpjs_aktif: BPJS,
    bpjs_manual: { 'jkk-prs': v(24_000) },
    pph_return: { nilai: v(15_000) },
  };
}

const px = loadPayrollCore();
const { sigajiRp, hitungGaji } = px;

assertEq('angka tetap', sigajiRp(1500000), 1500000);
assertEq('teks polos', sigajiRp('500000'), 500000);
assertEq('teks ribuan titik', sigajiRp('1.500.000'), 1500000);
assertEq('teks ribuan satu grup', sigajiRp('1.500'), 1500);
assertEq('teks Rp + spasi', sigajiRp('Rp 2.750.000'), 2750000);
assertEq('desimal titik', sigajiRp('2500.5'), 2500.5);
assertEq('desimal koma dibulatkan seperti kotak input', sigajiRp('1.250,5'), 1251);
assertEq('negatif', sigajiRp('-150.000'), -150000);
assertEq('kosong/null/NaN = 0', sigajiRp('') + sigajiRp(null) + sigajiRp(undefined) + sigajiRp(NaN) + sigajiRp('abc'), 0);

const gNum = hitungGaji(karyawan(false), 'Maret 2026', { skipResolve: true });
const gTxt = hitungGaji(karyawan(true), 'Maret 2026', { skipResolve: true });
for (const f of ['potT', 'natKP', 'natNKP', 'tGross', 'grossPPh', 'pph', 'pphRet', 'totalPot', 'neto', 'bebanPrs']) {
  assertEq('hitungGaji teks = angka: ' + f, gTxt[f], gNum[f]);
}
const kGapokTeks = Object.assign(karyawan(true), { gapok: '8.000.000' });
const gGapok = hitungGaji(kGapokTeks, 'Maret 2026', { skipResolve: true });
for (const f of ['gapokEff', 'gapokRate', 'gapokFull', 'grossPPh', 'neto']) {
  assertEq('gapok "8.000.000" = 8 juta: ' + f, gGapok[f], gNum[f]);
}
assertEq('potongan bertipe angka', typeof gTxt.potT, 'number');
assertEq('BPJS manual bertipe angka', typeof gTxt.bpjs.jkk_prs, 'number');
assertEq('neto bertipe angka', typeof gTxt.neto, 'number');

px.tunjVarBulan['Maret 2026'] = { 'TES-TEKS': { v1: '1.500.000' } };
px.tunjVarColumns = [{ id: 'v1', nama: 'Bonus' }];
const tv = px.getTunjVariabelForHitung('TES-TEKS', 'Maret 2026');
assertEq('tunjangan variabel "1.500.000" = 1,5 juta (bukan 1,5)', tv.length && tv[0].nilai, 1500000);

px.thrManual['Maret 2026'] = { 'TES-TEKS': { aktif: true, nilai: '2.000.000' } };
assertEq('THR manual teks = angka', px.hitungTHRBruto(karyawan(true), 'Maret 2026').nilai, 2000000);

/** Bulat setengah ke atas dengan aritmetika bilangan bulat (tanpa float): acuan "benar" untuk rupiah. */
const exactRound = (bruto, bp) => Math.floor((bruto * bp * 2 + 10000) / 20000);

const TER_A = vm.runInContext('TER_A', px);
const BPJS_DEF = vm.runInContext('BPJS_DEF', px);
let terCek = 0;
let terMeleset = 0;
for (let b = 5_400_001; b <= 9_000_000; b++) {
  const row = TER_A.find((r) => b <= r[0]);
  const bp = Math.round(row[1] * 10000);
  if ((b * bp) % 10000 !== 5000) continue;
  terCek++;
  if (px.hitungPPhBln(b, 'TK0') !== exactRound(b, bp)) terMeleset++;
}
assertEq('TER: ' + terCek + ' nilai tepat setengah rupiah, tidak ada yang meleset', terMeleset, 0);

let bpjsCek = 0;
let bpjsMeleset = 0;
const kB = { bpjs_aktif: BPJS, bpjs_manual: {} };
for (let b = 1_000_000; b <= 9_000_000; b += 7) {
  const r = px.calcBPJS(kB, b, 0);
  for (const [field, key] of [['jkk_prs', 'jkk-prs'], ['jkm_prs', 'jkm-prs'], ['jht_prs', 'jht-prs']]) {
    const bp = Math.round(BPJS_DEF[key].pct * 100);
    if ((b * bp) % 10000 !== 5000) continue;
    bpjsCek++;
    if (r[field] !== exactRound(b, bp)) bpjsMeleset++;
  }
}
assertEq('BPJS: ' + bpjsCek + ' nilai tepat setengah rupiah, tidak ada yang meleset', bpjsMeleset, 0);

console.log('\nAngka sebagai teks: semua tes lulus.');
