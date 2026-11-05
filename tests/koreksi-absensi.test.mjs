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

const px0 = loadPayrollCore({
  perusahaan: { hariKerja: 6, aturan_potongan: { alpha: { mode: 'prorata', nilai: 0 } } },
  karyawan: px.karyawan,
  periodes: JSON.parse(JSON.stringify(px.periodes)).map(function (p) {
    if (p.absensi_pot_baseline && p.absensi_pot_baseline.A001) {
      p.absensi_pot_baseline.A001 = { total: 0, details: [] };
    }
    return p;
  }),
  absensi: {},
  karSnapshot: px.karSnapshot,
});
const g0 = px0.hitungGaji(px0.karyawan[0], 'November 2026');
assertEq('koreksi turunkan dasar PPh', g.grossPPh, g0.grossPPh - kor.total);

const pxC = loadPayrollCore({
  perusahaan: { hariKerja: 6, aturan_potongan: { alpha: { mode: 'prorata', nilai: 0 } } },
  karyawan: px.karyawan,
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
  absensi: { A001: { '2026-10-31': 'alpha' } },
  karSnapshot: px.karSnapshot,
});
const korA = pxC.hitungKoreksiAbsensiBulanSebelumnya('A001', 'November 2026');
assertEq('cache tidak ditulis ke baseline', pxC.periodes[0].absensi_pot_baseline.A001.nowTotal == null, true);
const korA2 = pxC.hitungKoreksiAbsensiBulanSebelumnya('A001', 'November 2026');
assertEq('hitung ulang sesi: sidik jari sama', korA2.total, korA.total);

pxC.absensi.A001['2026-10-31'] = 'hadir';
const korB = pxC.hitungKoreksiAbsensiBulanSebelumnya('A001', 'November 2026');
assertEq('absensi dari luar (awan): hitung ulang', korB.total, 0);

const pxStale = loadPayrollCore({
  perusahaan: { hariKerja: 6, aturan_potongan: { alpha: { mode: 'prorata', nilai: 0 } } },
  karyawan: px.karyawan,
  periodes: [
    {
      id: 1,
      nama: 'Oktober 2026',
      start: '2026-10-01',
      end: '2026-10-31',
      bayar: '2026-10-30',
      status: 'tutup',
      snapshot_locked: true,
      absensi_pot_baseline: { A001: { total: 0, details: [], nowTotal: 0 } },
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
  absensi: { A001: { '2026-10-31': 'alpha' } },
  karSnapshot: px.karSnapshot,
});
const korStale = pxStale.hitungKoreksiAbsensiBulanSebelumnya('A001', 'November 2026');
assertEq('nowTotal basi di JSON diabaikan', korStale.total > 0, true);

pxC.absensi.A001['2026-10-31'] = 'alpha';
pxC.hariLibur = [{ tgl: '2026-10-31', nama: 'Libur uji', tipe: 'nasional' }];
const korLib = pxC.hitungKoreksiAbsensiBulanSebelumnya('A001', 'November 2026');
assertEq('hari libur baru: koreksi 0', korLib.total, 0);

const snapCuti = {
  gapok: 2700000,
  tunjangan: [],
  potongan: [],
  bpjs_aktif: {},
  natura: [],
  pph_return: { nilai: 0, ket: '' },
};
const pxYtd = loadPayrollCore({
  perusahaan: {
    hariKerja: 6,
    aturan_potongan: {
      cuti_dalam_kuota: { mode: 'tidak_dipotong', nilai: 0 },
      cuti_luar_kuota: { mode: 'prorata', nilai: 0 },
    },
  },
  masterCuti: { kuota: 1, cbPotong: false, hakBaru: 'langsung' },
  karyawan: [
    {
      nik: 'K4',
      nama: 'Kuota Satu',
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
      nama: 'Maret 2026',
      start: '2026-03-01',
      end: '2026-03-31',
      bayar: '2026-03-25',
      status: 'tutup',
      snapshot_locked: true,
    },
    {
      id: 2,
      nama: 'Oktober 2026',
      start: '2026-10-01',
      end: '2026-10-31',
      bayar: '2026-10-30',
      status: 'tutup',
      snapshot_locked: true,
      absensi_pot_baseline: { K4: { total: 0, details: [] } },
    },
    {
      id: 3,
      nama: 'November 2026',
      start: '2026-11-01',
      end: '2026-11-30',
      bayar: '2026-11-28',
      status: 'aktif',
    },
  ],
  absensi: { K4: { '2026-03-16': 'cuti', '2026-10-07': 'cuti' } },
  karSnapshot: {
    'Maret 2026': { K4: snapCuti },
    'Oktober 2026': { K4: snapCuti },
    'November 2026': { K4: snapCuti },
  },
});
const oktYtd = pxYtd.periodes.find(function (p) {
  return p.nama === 'Oktober 2026';
});
const potLuar = pxYtd.sigajiPotKehadiranUntukPeriodeNik('K4', oktYtd);
assertEq('cuti Oktober luar kuota (Maret sudah pakai 1)', potLuar.total > 0, true);
oktYtd.absensi_pot_baseline.K4 = { total: potLuar.total, details: potLuar.details || [] };
const korYtd0 = pxYtd.hitungKoreksiAbsensiBulanSebelumnya('K4', 'November 2026');
assertEq('sebelum hapus Maret: tidak ada koreksi', korYtd0.total, 0);
delete pxYtd.absensi.K4['2026-03-16'];
const korYtd1 = pxYtd.hitungKoreksiAbsensiBulanSebelumnya('K4', 'November 2026');
assertEq('hapus cuti Maret: pengembalian cuti Oktober', korYtd1.total, -potLuar.total);

console.log('\nKoreksi absensi: semua tes lulus.');
