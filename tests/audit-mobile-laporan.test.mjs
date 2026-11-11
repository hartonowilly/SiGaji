/**
 * Audit: alpha bukan hari kerja, PKP laporan, sim terkunci, THR masa kerja.
 * node tests/audit-mobile-laporan.test.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { fileURLToPath, pathToFileURL } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const tmpMob = path.join(os.tmpdir(), 'sigaji-mobile-shared-' + process.pid + '.mjs');
{
  const src = fs
    .readFileSync(path.join(ROOT, 'functions', '_lib', 'mobile-shared.js'), 'utf8')
    .replace(/import \{[\s\S]*?\} from '\.\/cf-shared\.js';/, '')
    .replace(/import \{[\s\S]*?\} from '\.\/tenant-data\.js';/, '')
    .replace(/export \{ loadCloudPayload, saveCloudPayload \};/, '');
  fs.writeFileSync(tmpMob, src);
}
const { enumerateWorkDates, payloadWorksSaturday, computeCutiBalanceForYear } = await import(
  pathToFileURL(tmpMob).href
);
fs.unlinkSync(tmpMob);

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

{
  const px = loadPayrollCore({
    perusahaan: { hariKerja: 5, aturan_potongan: { alpha: { mode: 'prorata', nilai: 0 } } },
    hariLibur: [{ tgl: '2026-03-09', nama: 'Libur PT', tipe: 'perusahaan' }],
    periodes: [{
      id: 1, nama: 'Maret 2026', start: '2026-03-01', end: '2026-03-31',
      bayar: '2026-03-31', status: 'aktif',
    }],
    karyawan: [{
      nik: 'A1', nama: 'Alpha filter', gapok: 10_000_000, ptkp: 'TK0',
      masuk: '2026-03-10', tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
    }],
    absensi: {
      A1: {
        '2026-03-02': 'alpha',
        '2026-03-07': 'alpha',
        '2026-03-08': 'alpha',
        '2026-03-09': 'alpha',
        '2026-03-11': 'alpha',
      },
    },
  });
  const p = px.periodes[0];
  const r = px.hitungPotonganKehadiran('A1', p, 22, 10_000_000);
  assertEq('alpha sebelum masuk diabaikan', r.nAlpha, 1);
}

{
  const px = loadPayrollCore({
    perusahaan: { hariKerja: 5, aturan_potongan: { alpha: { mode: 'prorata', nilai: 0 } } },
    hariLibur: [{ tgl: '2026-03-09', nama: 'Libur PT', tipe: 'perusahaan' }],
    periodes: [{
      id: 1, nama: 'Maret 2026', start: '2026-03-01', end: '2026-03-31',
      bayar: '2026-03-31', status: 'aktif',
    }],
    karyawan: [{
      nik: 'A2', nama: 'Lama', gapok: 10_000_000, ptkp: 'TK0',
      masuk: '2020-01-01', tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
    }],
    absensi: {
      A2: {
        '2026-03-07': 'alpha',
        '2026-03-08': 'alpha',
        '2026-03-09': 'alpha',
        '2026-03-10': 'alpha',
      },
    },
  });
  const r = px.hitungPotonganKehadiran('A2', px.periodes[0], 22, 10_000_000);
  assertEq('Sabtu-Minggu-libur PT tidak dihitung, Selasa dihitung', r.nAlpha, 1);
}

{
  const px = loadPayrollCore();
  const pkp = px.hitungPkpTahunan(120_000_000, 'TK0', '2026-12-31', { iuranJhtJpKar: 2_400_000 });
  const pph = px.hitungPPhTahunanProgresif(120_000_000, 'TK0', '2026-12-31', { iuranJhtJpKar: 2_400_000 });
  const palsu = Math.max(0, 10_000_000 * 12 - Math.min(120_000_000 * 0.05, 6e6) - px.nilaiPTKP('TK0', '2026-12-31'));
  assert('PKP memakai JHT+JP, bukan ×12 tanpa iuran', pkp < palsu);
  assert('PPh tahunan dari PKP mesin yang sama', pph > 0 && pkp > 0);
  const k = {
    nik: 'PKP1', nama: 'Des', gapok: 10_000_000, ptkp: 'TK0', masuk: '2020-01-01',
    tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
    pph_ytd_awal: { 2026: { bruto: 110_000_000, pph: 2_000_000, iuran_jht_jp: 2_200_000, sd_bulan: 11 } },
  };
  px.karyawan = [k];
  px.periodes[0].start = '2026-12-01';
  px.periodes[0].end = '2026-12-31';
  px.periodes[0].bayar = '2026-12-25';
  px.periodes[0].nama = 'Desember 2026';
  px.periodes[0].tipe_periode = 'desember';
  const g = px.hitungGaji(k, 'Desember 2026', { skipResolve: true });
  assert('rekonsiliasi menyimpan pkpTahunan', g.reconciliation && g.reconciliation.pkpTahunan != null);
  assertEq('pkp mesin = helper', g.reconciliation.pkpTahunan,
    px.hitungPkpTahunan(g.reconciliation.brutoTahunan, 'TK0', '2026-12-25', {
      bulanKerja: 12,
      iuranJhtJpKar: g.reconciliation.iuranTahunan,
    }));
}

{
  const px = loadPayrollCore();
  const k = {
    nik: 'F1', nama: 'Beku', gapok: 8_000_000, ptkp: 'TK0', masuk: '2020-01-01',
    tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
  };
  px.karyawan = [k];
  const p = px.periodes[0];
  p.snapshot_locked = true;
  p.hasil_gaji = { v: 1, byNik: { F1: { neto: 1, grossPPh: 1, pph: 1, gapokEff: 1 } } };
  const frozen = px.hitungGaji(k, p.nama, { skipResolve: true });
  assertEq('periode terkunci tanpa fresh memakai beku', frozen.neto, 1);
  k.gapok = 20_000_000;
  const live = px.hitungGaji(k, p.nama, { skipResolve: true, skipKreditBawa: true, fresh: true });
  assertEq('simulasi fresh menghitung gapok baru', live.gapokEff, 20_000_000);
}

{
  const px = loadPayrollCore({
    periodes: [{
      id: 1, nama: 'Mei 2026', start: '2026-05-01', end: '2026-05-31',
      bayar: '2026-05-25', thr_hariraya: '2026-05-20', thr_aktif: true, status: 'aktif',
    }],
  });
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'js/modules/sigaji-sim-thr-pesangon.js'), 'utf8'),
    px
  );
  const out = px.sigajiSimKarForThr({ masuk: '2020-01-01', gapok: 1 }, 'Mei 2026', { mkBulan: 6 });
  assertEq('masa kerja THR mundur dari hari raya', out.masuk, '2025-11-20');
}

{
  const payload5 = { perusahaan: { hariKerja: 5 }, hariLibur: [{ tgl: '2026-03-09', tipe: 'perusahaan' }] };
  const payload6 = { perusahaan: { hariKerja: 6 }, hariLibur: [{ tgl: '2026-03-09', tipe: 'nasional' }] };
  assertEq('perusahaan 5 hari: Sabtu bukan default kerja', payloadWorksSaturday(payload5, false), false);
  assertEq('penugasan Sabtu menimpa', payloadWorksSaturday(payload5, true), true);
  assertEq('perusahaan 6 hari: Sabtu kerja', payloadWorksSaturday(payload6, false), true);
  const d5 = enumerateWorkDates(payload5, '2026-03-07', '2026-03-10', false);
  assertEq('5 hari: skip Sabtu-Minggu-libur PT', d5.join(','), '2026-03-10');
  const d6 = enumerateWorkDates(payload6, '2026-03-07', '2026-03-10', false);
  assertEq('6 hari: Sabtu kerja, skip Minggu+nasional', d6.join(','), '2026-03-07,2026-03-10');
}

{
  const payload = {
    perusahaan: { hariKerja: 6 },
    masterCuti: { kuota: 12, hakBaru: 'setelah_12bln' },
    karyawan: [{ nik: 'C1', masuk: '2026-02-01' }],
    hariLibur: [],
    absensi: {},
  };
  const bal = computeCutiBalanceForYear(payload, 'C1', 2026, 0);
  assertEq('kuota setelah 12 bulan: belum dapat', bal.kuota, 0);
}

{
  const payload = {
    perusahaan: { hariKerja: 6 },
    masterCuti: { kuota: 12, carryover: 'yes', cbPotong: false, hakBaru: 'langsung' },
    karyawan: [{ nik: 'C2', masuk: '2025-01-01' }],
    hariLibur: [],
    absensi: { C2: { '2025-02-03': 'cuti', '2025-02-04': 'cuti' } },
  };
  const bal = computeCutiBalanceForYear(payload, 'C2', 2026, 0);
  assertEq('mobile carryover: kuota 12 + sisa 10', bal.kuota, 22);
}

{
  const payload = {
    perusahaan: { hariKerja: 6 },
    masterCuti: { kuota: 12, carryover: 'yes', cbPotong: false, hakBaru: 'langsung' },
    archiveCutoffYm: '2026-01',
    karyawan: [{ nik: 'C3', masuk: '2020-01-01', cuti_sisa_tahun: { '2025': 2 } }],
    hariLibur: [],
    absensi: {},
  };
  const bal = computeCutiBalanceForYear(payload, 'C3', 2026, 0);
  assertEq('mobile saldo tersimpan: 12 + 2', bal.kuota, 14);
}

console.log('\nAudit mobile/laporan: semua tes lulus.');
