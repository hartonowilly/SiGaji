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

console.log('\nKaryawan vs periode: semua tes lulus.');
