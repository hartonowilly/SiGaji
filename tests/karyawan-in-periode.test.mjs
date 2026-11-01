/**
 * Karyawan hanya tampil di periode yang masa kerjanya menyinggung.
 * Masuk setelah akhir periode → tidak masuk daftar (meski periode berikutnya belum dibuat).
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const SEPT = {
  nama: 'September 2026',
  start: '2026-08-25',
  end: '2026-09-24',
  bayar: '2026-09-25',
};

const px = loadPayrollCore();

assert(
  'masuk 1 Okt tidak tampil di periode September',
  px.karyawanInPeriode({ nik: 'K0018', masuk: '2026-10-01' }, SEPT) === false
);
assert(
  'masuk 24 Sep (hari terakhir periode) tetap tampil',
  px.karyawanInPeriode({ nik: 'K0018', masuk: '2026-09-24' }, SEPT) === true
);
assert(
  'masuk 25 Sep (setelah akhir periode) tidak tampil',
  px.karyawanInPeriode({ nik: 'K0018', masuk: '2026-09-25' }, SEPT) === false
);
assert(
  'karyawan lama tanpa tgl berhenti tampil',
  px.karyawanInPeriode({ nik: 'K0001', masuk: '2020-01-01' }, SEPT) === true
);
assert(
  'tanpa tgl masuk (data lama) tetap tampil',
  px.karyawanInPeriode({ nik: 'K0002' }, SEPT) === true
);
assert(
  'resign sebelum periode tidak tampil',
  px.karyawanInPeriode(
    { nik: 'K0003', masuk: '2020-01-01', tgl_berhenti: '2026-08-20' },
    SEPT
  ) === false
);
assert(
  'resign di dalam periode tampil (gaji terakhir)',
  px.karyawanInPeriode(
    { nik: 'K0004', masuk: '2020-01-01', tgl_berhenti: '2026-09-10' },
    SEPT
  ) === true
);
assert(
  'resign 10 Sep tetap tampil walau tgl bayar 25 Sep sudah lewat tanggal berhenti',
  px.karyawanInPeriode(
    { nik: 'K0005', masuk: '2020-01-01', tgl_berhenti: '2026-09-10' },
    SEPT
  ) === true
);
assert(
  'tanggal berhenti dd/mm/yyyy di dalam periode tetap tampil',
  px.karyawanInPeriode(
    { nik: 'K0006', masuk: '01/01/2020', tgl_berhenti: '10/09/2026' },
    SEPT
  ) === true
);
assert(
  'resign sehari setelah akhir periode tetap tampil (masih gaji periode ini)',
  px.karyawanInPeriode(
    { nik: 'K0007', masuk: '2020-01-01', tgl_berhenti: '2026-09-25' },
    SEPT
  ) === true
);

const OCT = {
  nama: 'Oktober 2026',
  start: '2026-10-01',
  end: '2026-10-31',
  bayar: '2026-10-30',
};

const resignAug = { nik: 'K0101', masuk: '2020-01-01', tgl_berhenti: '2026-08-20' };
const resignSep = { nik: 'K0102', masuk: '2020-01-01', tgl_berhenti: '2026-09-10' };
const resignOct = { nik: 'K0103', masuk: '2020-01-01', tgl_berhenti: '2026-10-05' };
const resignNov = { nik: 'K0104', masuk: '2020-01-01', tgl_berhenti: '2026-11-01' };
const aktif = { nik: 'K0105', masuk: '2020-01-01' };

assert(
  'tab Resign September: resign Agustus ikut (kumulatif)',
  px.karyawanResignSampaiPeriode(resignAug, SEPT) === true
);
assert(
  'tab Resign September: resign 10 Sep tampil',
  px.karyawanResignSampaiPeriode(resignSep, SEPT) === true
);
assert(
  'tab Resign September: resign Oktober belum tampil',
  px.karyawanResignSampaiPeriode(resignOct, SEPT) === false
);
assert(
  'tab Resign Oktober: 3 orang sampai Oktober tampil, November belum',
  px.karyawanResignSampaiPeriode(resignAug, OCT) === true &&
    px.karyawanResignSampaiPeriode(resignSep, OCT) === true &&
    px.karyawanResignSampaiPeriode(resignOct, OCT) === true &&
    px.karyawanResignSampaiPeriode(resignNov, OCT) === false
);
assert(
  'tanpa tgl berhenti bukan resign',
  px.karyawanResignSampaiPeriode(aktif, OCT) === false
);
assert(
  'karyawan di sampah tidak masuk tab Resign',
  px.karyawanResignSampaiPeriode(
    { nik: 'K0106', tgl_berhenti: '2026-09-01', dihapusPada: '2026-09-02T00:00:00.000Z' },
    OCT
  ) === false
);
assert(
  'tanggal berhenti dd/mm/yyyy sampai periode tetap kumulatif',
  px.karyawanResignSampaiPeriode(
    { nik: 'K0107', masuk: '01/01/2020', tgl_berhenti: '10/09/2026' },
    OCT
  ) === true
);

const sorted = [resignAug, resignOct, resignSep].slice().sort(px.cmpKarResignTglDesc);
assert(
  'sort resign: yang paling akhir berhenti di paling atas',
  sorted[0].nik === 'K0103' && sorted[1].nik === 'K0102' && sorted[2].nik === 'K0101'
);
const mixedFmt = [
  { nik: 'A', tgl_berhenti: '05/10/2026' },
  { nik: 'B', tgl_berhenti: '2026-11-01' },
  { nik: 'C', tgl_berhenti: '20/08/2026' },
].sort(px.cmpKarResignTglDesc);
assert(
  'sort resign menormalisasi dd/mm/yyyy',
  mixedFmt[0].nik === 'B' && mixedFmt[1].nik === 'A' && mixedFmt[2].nik === 'C'
);

console.log('\nKaryawan vs periode: semua tes lulus.');
