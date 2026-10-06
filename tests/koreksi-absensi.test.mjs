/**
 * Koreksi absensi bulan sebelumnya (baseline saat kunci periode).
 * node tests/koreksi-absensi.test.mjs
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore({
  perusahaan: {
    hariKerja: 6,
    aturan_potongan: { alpha: { mode: 'prorata', nilai: 0 } },
  },
  karyawan: [
    {
      nik: 'A001',
      nama: 'Karyawan A',
      gapok: 2700000,
      ptkp: 'TK0',
      tunjangan: [],
      potongan: [],
      bpjs_aktif: {},
      natura: [],
    },
  ],
  periodes: [
    {
      id: 1,
      nama: 'Oktober 2026',
      start: '2026-10-01',
      end: '2026-10-31',
      bayar: '2026-10-30',
      status: 'tutup',
      snapshot_locked: true,
      absensi_pot_baseline: { A001: { total: 0, details: [] } },
    },
    {
      id: 2,
      nama: 'November 2026',
      start: '2026-11-01',
      end: '2026-11-30',
      bayar: '2026-11-28',
      status: 'aktif',
    },
  ],
  absensi: {
    A001: { '2026-10-31': 'alpha' },
  },
  karSnapshot: {
    'Oktober 2026': { A001: { gapok: 2700000, tunjangan: [], potongan: [], bpjs_aktif: {}, natura: [], pph_return: { nilai: 0, ket: '' } } },
    'November 2026': { A001: { gapok: 2700000, tunjangan: [], potongan: [], bpjs_aktif: {}, natura: [], pph_return: { nilai: 0, ket: '' } } },
  },
});

const { hitungGaji, hitungKoreksiAbsensiBulanSebelumnya } = px;

const k = px.karyawan[0];
const kor = hitungKoreksiAbsensiBulanSebelumnya('A001', 'November 2026');
assertEq('koreksi total > 0', kor.total > 0, true);
assertEq('koreksi punya detail', (kor.details || []).length > 0, true);

const g = hitungGaji(k, 'November 2026');
assertEq('THP termasuk koreksi absensi', (g.koreksiAbsensi && g.koreksiAbsensi.total) === kor.total, true);
assertEq('neto turun karena koreksi', g.neto < g.brutoTH, true);

console.log('\nKoreksi absensi: semua tes lulus.');
