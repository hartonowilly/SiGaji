/**
 * Tes Lapisan C — THR + rekonsiliasi PPh Desember (karyawan fiktif).
 * Tidak menyentuh database.
 *
 * Jalankan: node tests/payroll-scenario-advanced.test.mjs
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

// ── THR: periode thr_aktif, masa kerja ≥ 12 bulan ───────────────
const pxThr = loadPayrollCore({
  periodes: [
    {
      id: 1,
      nama: 'Idul Fitri 2026',
      start: '2026-03-01',
      end: '2026-03-31',
      bayar: '2026-03-31',
      status: 'aktif',
      thr_aktif: true,
      tipe_periode: 'biasa',
    },
  ],
});

const kThr = {
  nik: 'TES-THR',
  nama: 'Andi Contoh THR (fiktif)',
  gapok: 6_000_000,
  ptkp: 'TK0',
  masuk: '2019-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsAktif,
};

const gThr = pxThr.hitungGaji(kThr, 'Idul Fitri 2026', { skipResolve: true });

// Dasar THR = gapok 6jt (12/12), digabung ke gross PPh
assertEq('Andi THR bruto 6jt', gThr.thrBruto, 6_000_000);
assertEq('Andi periode ada THR', gThr.periodeAdaTHR, true);
// gross regular ~6.272.400 + THR 6jt = 12.272.400
assertEq('Andi grossPPh termasuk THR', gThr.grossPPh, 12_272_400);
assertEq('Andi PPh total bulan THR', gThr.pph, 490_896);
// Selisih PPh atas THR saja
assertEq('Andi PPh atas THR', gThr.pphAtasThr, 443_853);
// THP tidak termasuk THR bruto di brutoTH; neto termasuk alur potongan biasa
assertEq('Andi neto bulan THR', gThr.neto, 5_269_104);

// ── Desember: rekonsiliasi tahunan (Jan + Des, TK/0, gapok 10jt) ─
const pxDes = loadPayrollCore({
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
      nama: 'Des 2026',
      start: '2026-12-01',
      end: '2026-12-31',
      bayar: '2026-12-31',
      status: 'aktif',
      thr_aktif: false,
      tipe_periode: 'desember',
    },
  ],
});

const kDes = {
  nik: 'TES-DES',
  nama: 'Dewi Contoh Desember (fiktif)',
  gapok: 10_000_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsAktif,
};

const gJan = pxDes.hitungGaji(kDes, 'Jan 2026', { skipResolve: true });
const gDes = pxDes.hitungGaji(kDes, 'Des 2026', { skipResolve: true });

// Jan: TER bulanan biasa
assertEq('Dewi Jan grossPPh', gJan.grossPPh, 10_454_000);
assertEq('Dewi Jan PPh TER', gJan.pph, 261_350);

// Des: bruto tahunan 2×10,45jt masih di bawah PTKP+BJ → PPh tahunan 0 → lebih bayar
assertEq('Dewi Des masa pajak terakhir', gDes.isMasaPajakTerakhir, true);
assertEq('Dewi Des PPh bulan ini (refund)', gDes.pph, 0);
assertEq('Dewi Des lebih bayar', gDes.reconciliation.lebihBayar, 261_350);
assertEq('Dewi Des kurang bayar', gDes.reconciliation.kurangBayar, 0);
assertEq('Dewi Des bruto YTD dari Jan', gDes.reconciliation.brutoYTD, 10_454_000);
assertEq('Dewi Des PPh YTD dari Jan', gDes.reconciliation.pphYTD, 261_350);

console.log('\nLapisan C: semua tes lulus (14 assert).');
