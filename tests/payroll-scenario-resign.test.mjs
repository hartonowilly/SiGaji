/**
 * Tes resign tengah tahun — rekonsiliasi PPh terakhir (karyawan fiktif).
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const bpjsAktif = {
  'kes-prs': true,
  'kes-kar': true,
  'jht-prs': true,
  'jht-kar': true,
  'jp-prs': true,
  'jp-kar': true,
  'jkk-prs': true,
  'jkm-prs': true,
};

const px = loadPayrollCore({
  periodes: [
    {
      id: 1,
      nama: 'Jan 2026',
      start: '2026-01-01',
      end: '2026-01-31',
      bayar: '2026-01-31',
      status: 'tutup',
      thr_aktif: false,
      tipe_periode: 'biasa',
    },
    {
      id: 2,
      nama: 'Feb 2026',
      start: '2026-02-01',
      end: '2026-02-28',
      bayar: '2026-02-28',
      status: 'tutup',
      thr_aktif: false,
      tipe_periode: 'biasa',
    },
    {
      id: 3,
      nama: 'Mar 2026',
      start: '2026-03-01',
      end: '2026-03-31',
      bayar: '2026-03-31',
      status: 'aktif',
      thr_aktif: false,
      tipe_periode: 'biasa',
    },
  ],
});

const kResign = {
  nik: 'TES-RESIGN',
  nama: 'Eko Contoh Resign (fiktif)',
  gapok: 9_000_000,
  ptkp: 'TK0',
  masuk: '2022-06-01',
  tgl_berhenti: '2026-03-15',
  phk: { alasan: 'resign_30hr' },
  tunjangan: [
    { nama: 'Tunj Jab', nilai: 1_000_000, tipe: 'tetap', thr_ikut: true, prorata_ikut: true },
  ],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsAktif,
};

const gJan = px.hitungGaji(kResign, 'Jan 2026', { skipResolve: true });
const gFeb = px.hitungGaji(kResign, 'Feb 2026', { skipResolve: true });
const gMar = px.hitungGaji(kResign, 'Mar 2026', { skipResolve: true });

// Jan–Feb: pola sama (gapok 9jt + tunj 1jt)
assertEq('Eko Jan grossPPh', gJan.grossPPh, 10_454_000);
assertEq('Eko Jan PPh TER', gJan.pph, 261_350);
assertEq('Eko Feb PPh TER', gFeb.pph, 261_350);

// Mar: masa pajak terakhir (resign) — YTD dari Jan+Feb, lebih bayar
assertEq('Eko Mar masa pajak terakhir', gMar.isMasaPajakTerakhir, true);
assertEq('Eko Mar grossPPh', gMar.grossPPh, 10_408_600);
assertEq('Eko Mar PPh (refund)', gMar.pph, 0);
assertEq('Eko Mar neto', gMar.neto, 9_640_000);
assertEq('Eko Mar tipe rekonsiliasi', gMar.reconciliation.tipePeriode, 'resign');
assertEq('Eko Mar lebih bayar', gMar.reconciliation.lebihBayar, 522_700);
assertEq('Eko Mar PPh YTD sebelum Mar', gMar.reconciliation.pphYTD, 522_700);
assertEq('Eko Mar bruto YTD sebelum Mar', gMar.reconciliation.brutoYTD, 20_908_000);

console.log('\nResign: semua tes lulus (11 assert).');
