/**
 * Tes Lapisan A — rumus payroll atom (PPh TER, BPJS, pesangon final).
 *
 * TIDAK menyentuh database / Supabase / data karyawan sungguhan.
 * Jawaban expected dihitung dari PMK 168/2023 (TER), tarif progresif, BPJS_DEF.
 *
 * Jalankan: node tests/payroll-pure.test.mjs
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore();
const {
  hitungPPhBln,
  hitungPPhTahunanProgresif,
  hitungPPhFinalPesangon,
  calcBPJS,
  getTERTable,
} = px;

// ── PPh TER bulanan (PMK 168/2023) ─────────────────────────────
assertEq('PPh bruto 0', hitungPPhBln(0, 'TK0'), 0);
assertEq('PPh bruto negatif', hitungPPhBln(-1, 'TK0'), 0);

// TER_A: bruto ≤ 5.400.000 → tarif 0%
assertEq('TK0 5,4jt TER 0%', hitungPPhBln(5_400_000, 'TK0'), 0);

// TER_A: bruto ≤ 5.650.000 → tarif 0,25% → 5.500.000 × 0,0025 = 13.750
assertEq('TK0 5,5jt TER 0,25%', hitungPPhBln(5_500_000, 'TK0'), 13_750);

// TER_A: bruto ≤ 10.050.000 → tarif 2% → 10.000.000 × 0,02 = 200.000
assertEq('TK0 10jt TER 2%', hitungPPhBln(10_000_000, 'TK0'), 200_000);

// TER_B (K/1): bruto ≤ 6.200.000 → tarif 0%
assertEq('K1 6,2jt TER 0%', hitungPPhBln(6_200_000, 'K1'), 0);

// TER_C (K/3): bruto ≤ 6.600.000 → tarif 0%
assertEq('K3 6,6jt TER 0%', hitungPPhBln(6_600_000, 'K3'), 0);

// Lampiran TER: TK0 & K0 pakai tarif yang sama (bracket pertama 0%)
assertEq('TER TK0 vs K0 konsisten', hitungPPhBln(6_000_000, 'TK0'), hitungPPhBln(6_000_000, 'K0'));
assertEq('getTERTable K3 beda dari TK0', getTERTable('K3') !== getTERTable('TK0'), true);

// ── PPh progresif tahunan (rekonsiliasi Des/resign) ─────────────
// Bruto tahunan 60jt, PTKP TK0 54jt, biaya jabatan min(5%,6jt)=3jt
// PKP = floor((60-3-54)jt/1000)*1000 = 3jt → 5% = 150.000
assertEq('PPh tahunan TK0 bruto 60jt', hitungPPhTahunanProgresif(60_000_000, 'TK0'), 150_000);

// Bruto 120jt: PKP = 60jt → 5% = 3jt
assertEq('PPh tahunan TK0 bruto 120jt', hitungPPhTahunanProgresif(120_000_000, 'TK0'), 3_000_000);

// Bruto 200jt: PKP = 140jt → 3jt + (140-60)jt×15% = 15jt
assertEq('PPh tahunan TK0 bruto 200jt', hitungPPhTahunanProgresif(200_000_000, 'TK0'), 15_000_000);

// ── PPh final pesangon (PP 68/2009 berlapis) ───────────────────
assertEq('PPh final pesangon 0', hitungPPhFinalPesangon(0), 0);
assertEq('PPh final pesangon 50jt (lapis 0%)', hitungPPhFinalPesangon(50_000_000), 0);
// 50jt×0% + 25jt×5% = 1.250.000
assertEq('PPh final pesangon 75jt', hitungPPhFinalPesangon(75_000_000), 1_250_000);
// 50jt×0% + 50jt×5% + 50jt×15% = 10jt
assertEq('PPh final pesangon 150jt', hitungPPhFinalPesangon(150_000_000), 10_000_000);

// ── BPJS (BPJS_DEF di constants.js) ────────────────────────────
const kBpjs = {
  nik: 'TES001',
  gapok: 8_000_000,
  bpjs_aktif: {
    'kes-prs': true,
    'kes-kar': true,
    'jht-prs': true,
    'jht-kar': true,
    'jp-prs': true,
    'jp-kar': true,
    'jkk-prs': true,
    'jkm-prs': true,
  },
};
// Basis 8jt gapok + 2jt tunj tetap = 10jt
const bpjs = calcBPJS(kBpjs, 8_000_000, 2_000_000);
assertEq('BPJS Kes prs 4% cap 12jt', bpjs.kes_prs, 400_000);
assertEq('BPJS Kes kar 1%', bpjs.kes_kar, 100_000);
assertEq('BPJS JHT prs 3,7%', bpjs.jht_prs, 370_000);
assertEq('BPJS JHT kar 2%', bpjs.jht_kar, 200_000);
assertEq('BPJS JP prs 2% cap', bpjs.jp_prs, 191_192);
assertEq('BPJS JP kar 1% cap', bpjs.jp_kar, 95_596);
assertEq('BPJS JKK prs 0,24%', bpjs.jkk_prs, 24_000);
assertEq('BPJS JKM prs 0,3%', bpjs.jkm_prs, 30_000);

// Komponen nonaktif → 0
const kOff = { nik: 'TES002', gapok: 5_000_000, bpjs_aktif: { 'kes-prs': false, 'kes-kar': false } };
const bpjsOff = calcBPJS(kOff, 5_000_000, 0);
assertEq('BPJS mati → kes 0', bpjsOff.kes_prs, 0);
assertEq('BPJS mati → kes kar 0', bpjsOff.kes_kar, 0);

console.log('\nLapisan A: semua tes lulus (' + 24 + ' assert).');
