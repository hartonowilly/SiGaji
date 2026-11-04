/**
 * Tes Lapisan B — skenario hitungGaji() dengan karyawan FIKSI (TESxxx).
 * Tidak menulis ke Supabase; hanya variabel memori di sandbox Node.
 *
 * Jalankan: node tests/payroll-scenario.test.mjs
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore();
const { hitungGaji } = px;

/** Karyawan contoh: Budi fiktif, gaji pokok 8jt, TK/0, BPJS aktif, bulan penuh. */
const kBudi = {
  nik: 'TES-BUDI',
  nama: 'Budi Contoh (fiktif)',
  gapok: 8_000_000,
  ptkp: 'TK0',
  dept: 'QA',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
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

const g = hitungGaji(kBudi, 'Maret 2026', { skipResolve: true });

// Gross PPh = gapok + BPJS perusahaan (JKK+JKM+Kes) — basis gapok 8jt (tanpa tunjangan)
// Kes prs 320.000 + JKK 19.200 + JKM 24.000 = 363.200 → 8.363.200
assertEq('Budi grossPPh', g.grossPPh, 8_363_200);

// TER_A bracket ≤ 8.550.000 → 1,5% → round(8.363.200 × 0,015) = 125.448
assertEq('Budi PPh TER', g.pph, 125_448);

// THP: brutoTH 8jt − (BPJS kar 320.000 + PPh 125.448) = 7.554.552
assertEq('Budi neto', g.neto, 7_554_552);
assertEq('Budi tidak prorata', !g.isPR, true);
assertEq('Budi tanpa THR', g.thrBruto, 0);

/** Karyawan contoh: Siti fiktif, pro-rata 15/22 HK. */
const kSiti = {
  nik: 'TES-SITI',
  nama: 'Siti Contoh (fiktif)',
  gapok: 11_000_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
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

px.prorata['TES-SITI'] = {
  'Maret 2026': { enabled: true, hk: 22, hh: 15, manual: true },
};

const g2 = hitungGaji(kSiti, 'Maret 2026', { skipResolve: true });

// gapokEff = round(11jt × 15/22) = 7.500.000
assertEq('Siti gapok efektif prorata', g2.gapokEff, 7_500_000);
assertEq('Siti flag prorata', g2.isPR, true);

// Iuran BPJS sebulan penuh (bukan prorata). Basis 11jt.
// kes_prs 440.000 + JKK 26.400 + JKM 33.000 = 499.400 → gross 7.999.400
assertEq('Siti grossPPh prorata', g2.grossPPh, 7_999_400);
assertEq('Siti BPJS tidak diprorata', g2.gapokBpjs, 11_000_000);

// TER 1,5% pada 7.999.400 → 119.991
assertEq('Siti PPh prorata', g2.pph, 119_991);

// THP: 7.500.000 − (kes 110rb + JHT 220rb + JP 110rb) − 119.991 = 6.940.009
assertEq('Siti neto prorata', g2.neto, 6_940_009);

console.log('\nLapisan B: semua tes lulus (' + 10 + ' assert).');
