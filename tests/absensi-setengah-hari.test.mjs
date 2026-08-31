/**
 * Tes status setengah hari (1/2 Sakit, 1/2 Izin) — data FIKSI, tanpa database.
 *
 * Menjaga dua hal yang pernah salah:
 *  1. 1/2 izin / 1/2 sakit harus bernilai 0,5 hari di rekap (bukan 1 hari penuh).
 *  2. Potongan gaji untuk status setengah hari harus benar-benar terhitung.
 *
 * Jalankan: node tests/absensi-setengah-hari.test.mjs
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const PERIODE = {
  id: 9,
  nama: 'Agustus 2026',
  start: '2026-08-01',
  end: '2026-08-31',
  bayar: '2026-09-01',
  status: 'aktif',
  tipe_periode: 'biasa',
};

const NIK = 'TES-HALF';

function aturan(extra = {}) {
  return {
    cuti_dalam_kuota: { mode: 'tidak_dipotong', nilai: 0 },
    cuti_luar_kuota: { mode: 'prorata', nilai: 0 },
    izin: { mode: 'prorata', nilai: 0 },
    sakit: { mode: 'prorata', nilai: 0 },
    setengah_sakit: { mode: 'prorata_setengah', nilai: 0 },
    setengah_ijin: { mode: 'prorata_setengah', nilai: 0 },
    alpha: { mode: 'prorata', nilai: 0 },
    ...extra,
  };
}

function setup(absensiNik, aturanPotongan) {
  return loadPayrollCore({
    perusahaan: { hariKerja: 6, aturan_potongan: aturanPotongan || aturan() },
    periodes: [PERIODE],
    karyawan: [{ nik: NIK, nama: 'Karyawan Uji (fiktif)', gapok: 5_200_000, tgl_berhenti: '' }],
    absensi: { [NIK]: absensiNik },
    masterCuti: { cbPotong: false, kuota: 12 },
  });
}

// ── 1. Bobot & format hari ────────────────────────
{
  const px = setup({});
  assertEq('bobot 1/2 izin = 0,5 hari', px.bobotHariAbsen('setengah_ijin'), 0.5);
  assertEq('bobot 1/2 sakit = 0,5 hari', px.bobotHariAbsen('setengah_sakit'), 0.5);
  assertEq('bobot izin penuh = 1 hari', px.bobotHariAbsen('izin'), 1);
  assertEq('format 0,5', px.fmtHariAbsen(0.5), '0,5');
  assertEq('format 1,5', px.fmtHariAbsen(1.5), '1,5');
  assertEq('format bulat tanpa desimal', px.fmtHariAbsen(3), '3');
  assertEq('format nol dikosongkan', px.fmtHariAbsen(0), '');
  assertEq('format nol eksplisit', px.fmtHariAbsen(0, false), '0');
}

// ── 2. Potongan 1/2 izin = separuh gaji harian ────
{
  const px = setup({ '2026-08-05': 'setengah_ijin' });
  const hk = 26;
  const r = px.hitungPotonganKehadiran(NIK, PERIODE, hk, 5_200_000);
  assertEq('gaji harian', r.gajiHarian, 200_000);
  assertEq('jumlah 1/2 izin', r.n05I, 1);
  assertEq('potongan 1/2 izin = 1/2 hari', r.total, 100_000);
  assertEq('rincian potongan muncul', r.details.length, 1);
  assertEq('label rincian', r.details[0].label, '1/2 Izin (1hr)');
}

// ── 3. Izin penuh tetap 1 hari penuh ──────────────
{
  const px = setup({ '2026-08-05': 'izin' });
  const r = px.hitungPotonganKehadiran(NIK, PERIODE, 26, 5_200_000);
  assertEq('potongan izin penuh', r.total, 200_000);
}

// ── 4. Campuran: 1/2 izin + 1/2 sakit + izin penuh ─
{
  const px = setup({
    '2026-08-05': 'setengah_ijin',
    '2026-08-12': 'setengah_sakit',
    '2026-08-20': 'izin',
  });
  const r = px.hitungPotonganKehadiran(NIK, PERIODE, 26, 5_200_000);
  assertEq('total campuran (0,5+0,5+1 hari)', r.total, 400_000);
}

// ── 5. Aturan khusus: 1/2 izin dipotong penuh ─────
{
  const px = setup(
    { '2026-08-05': 'setengah_ijin' },
    aturan({ setengah_ijin: { mode: 'prorata', nilai: 0 } })
  );
  const r = px.hitungPotonganKehadiran(NIK, PERIODE, 26, 5_200_000);
  assertEq('aturan prorata penuh untuk 1/2 izin', r.total, 200_000);
}

// ── 6. Aturan nominal tetap ───────────────────────
{
  const px = setup(
    { '2026-08-05': 'setengah_ijin', '2026-08-06': 'setengah_ijin' },
    aturan({ setengah_ijin: { mode: 'nominal', nilai: 75_000 } })
  );
  const r = px.hitungPotonganKehadiran(NIK, PERIODE, 26, 5_200_000);
  assertEq('aturan nominal 2 × 75.000', r.total, 150_000);
}

// ── 7. Tidak dipotong → nol ───────────────────────
{
  const px = setup(
    { '2026-08-05': 'setengah_ijin' },
    aturan({ setengah_ijin: { mode: 'tidak_dipotong', nilai: 0 } })
  );
  const r = px.hitungPotonganKehadiran(NIK, PERIODE, 26, 5_200_000);
  assertEq('aturan tidak dipotong', r.total, 0);
}

// ── 8. Tanggal di luar periode diabaikan ──────────
{
  const px = setup({ '2026-07-30': 'setengah_ijin', '2026-09-02': 'setengah_ijin' });
  const r = px.hitungPotonganKehadiran(NIK, PERIODE, 26, 5_200_000);
  assertEq('di luar rentang periode tidak dipotong', r.total, 0);
}

// ── 9. Potongan ikut mengurangi THP ───────────────
{
  const kar = {
    nik: NIK,
    nama: 'Karyawan Uji (fiktif)',
    gapok: 5_200_000,
    ptkp: 'TK0',
    dept: 'QA',
    masuk: '2020-01-01',
    tunjangan: [],
    potongan: [],
    natura: [],
    bpjs_aktif: {},
  };
  const pxTanpa = loadPayrollCore({
    perusahaan: { hariKerja: 6, aturan_potongan: aturan() },
    periodes: [PERIODE],
    karyawan: [kar],
    absensi: { [NIK]: {} },
    masterCuti: { cbPotong: false, kuota: 12 },
  });
  const pxDengan = loadPayrollCore({
    perusahaan: { hariKerja: 6, aturan_potongan: aturan() },
    periodes: [PERIODE],
    karyawan: [kar],
    absensi: { [NIK]: { '2026-08-05': 'setengah_ijin' } },
    masterCuti: { cbPotong: false, kuota: 12 },
  });
  const gTanpa = pxTanpa.hitungGaji(kar, PERIODE.nama, { skipResolve: true });
  const gDengan = pxDengan.hitungGaji(kar, PERIODE.nama, { skipResolve: true });
  assertEq('tanpa 1/2 izin: potongan absen nol', gTanpa.potKehadiran.total, 0);
  assertEq(
    'THP turun sebesar potongan 1/2 izin',
    gTanpa.neto - gDengan.neto,
    gDengan.potKehadiran.total
  );
  assertEq('potongan 1/2 izin > 0', gDengan.potKehadiran.total > 0, true);
}

console.log('\nSetengah hari: semua tes lulus.');
