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

// ── Routing pajak PHK vs Resign atas pesangon/UPH/uang pisah ────────────
// Harness dasar tidak memuat pesangon.js (hitungPesangon undefined → blok PHK
// di-skip). Untuk menguji kontrak app-core, inject stub hitungPesangon yang
// hanya membaca field override di k.phk — mengisolasi logika routing pajak.
function stubPesangon(k) {
  const phk = (k && k.phk) || {};
  const num = (v) => Math.round(parseFloat(v) || 0);
  const up = num(phk.up_manual);
  const upmk = num(phk.upmk_manual);
  const uph = num(phk.uph_manual) + num(phk.uph_tambahan);
  const pisah = num(phk.pisah);
  return {
    ok: true, up, upmk, uph, pisah, total: up + upmk + uph + pisah,
    dasar: 0, mk: 0, bUp: 0, bUpmk: 0, sisaCuti: 0, sisaCutiAuto: 0, uphCuti: 0,
    opt: { f: 0 }, faktor: 0,
  };
}

const periodesPx = JSON.parse(JSON.stringify(px.periodes));
const px2 = loadPayrollCore({ periodes: periodesPx, hitungPesangon: stubPesangon });

const baseStop = {
  gapok: 9_000_000,
  ptkp: 'TK0',
  masuk: '2022-06-01',
  tgl_berhenti: '2026-03-15',
  tunjangan: [{ nama: 'Tunj Jab', nilai: 1_000_000, tipe: 'tetap', thr_ikut: true, prorata_ikut: true }],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsAktif,
};

// Resign tanpa & dengan uang pisah — selisihnya harus tepat sebesar uang pisah.
const gResignTanpa = px2.hitungGaji(
  { ...baseStop, nik: 'R-TANPA', nama: 'Resign tanpa pisah', phk: { alasan: 'resign_30hr' } },
  'Mar 2026', { skipResolve: true }
);
const gResignPisah = px2.hitungGaji(
  { ...baseStop, nik: 'R-PISAH', nama: 'Resign + pisah', phk: { alasan: 'resign_30hr', pisah: 5_000_000 } },
  'Mar 2026', { skipResolve: true }
);

// Uang pisah resign → masuk dasar PPh 21 progresif (non-final)
assertEq('Resign pisah: grossPPh naik = uang pisah', gResignPisah.grossPPh, gResignTanpa.grossPPh + 5_000_000);
// Uang pisah resign → masuk dasar take home (tidak menguap)
assertEq('Resign pisah: brutoTH naik = uang pisah', gResignPisah.brutoTH, gResignTanpa.brutoTH + 5_000_000);
// Tetap mode resign, tanpa PPh final pesangon
assertEq('Resign pisah: mode resign', gResignPisah.phk.mode, 'resign');
assertEq('Resign pisah: PPh final = 0', gResignPisah.phk.pphFinal, 0);
// Item uang pisah muncul di rincian (untuk slip)
assertEq(
  'Resign pisah: item muncul di tItems',
  gResignPisah.tItems.some((it) => it.nama === 'Uang pisah (Resign)' && it.eff === 5_000_000),
  true
);

// PHK → seluruh paket (UP+UPMK+UPH+pisah) kena PPh 21 FINAL (PP 68/2009),
// dipisah dari PPh progresif gaji. UP 200jt: 50jt@0 + 50jt@5% + 100jt@15% = 17,5jt.
const gPHK = px2.hitungGaji(
  { ...baseStop, nik: 'PHK-1X', nama: 'PHK 1x', phk: { alasan: 'phk_1x', up_manual: 200_000_000 } },
  'Mar 2026', { skipResolve: true }
);
assertEq('PHK: mode phk', gPHK.phk.mode, 'phk');
assertEq('PHK: dasar final = bruto pesangon', gPHK.phk.pphFinalBase, 200_000_000);
assertEq('PHK: PPh final PP 68/2009', gPHK.phk.pphFinal, 17_500_000);
// Pesangon final TIDAK masuk grossPPh progresif (tidak double-tax)
assertEq('PHK: pesangon di luar grossPPh progresif', gPHK.grossPPh, gResignTanpa.grossPPh);

console.log('\nResign: semua tes lulus (20 assert).');
