/**
 * Rekonsiliasi Desember mengikuti tanggal bayar (masa pajak), bukan tanggal selesai.
 * Pola bayar awal bulan berikutnya: gaji Nov dibayar 5 Des = masa pajak Desember.
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

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
  'kes-prs': false,
  'kes-kar': false,
  'jht-prs': false,
  'jht-kar': false,
  'jp-prs': false,
  'jp-kar': false,
  'jkk-prs': false,
  'jkm-prs': false,
};

const pNov = {
  id: 11,
  nama: 'November 2026',
  start: '2026-10-25',
  end: '2026-11-24',
  bayar: '2026-12-05',
  status: 'tutup',
  tipe_periode: 'normal',
};
const pDes = {
  id: 12,
  nama: 'Desember 2026',
  start: '2026-11-25',
  end: '2026-12-24',
  bayar: '2027-01-05',
  status: 'aktif',
  tipe_periode: 'desember',
};
const pDesSameMonth = {
  id: 13,
  nama: 'Desember kalender',
  start: '2026-12-01',
  end: '2026-12-31',
  bayar: '2026-12-31',
  status: 'tutup',
  tipe_periode: 'normal',
};

{
  const px = loadPayrollCore({ periodes: [pNov, pDes, pDesSameMonth] });
  assertEq('Nov dibayar 5 Des = rekonsiliasi', px.periodePakaiRekonsiliasiTahunan(pNov), true);
  assertEq('Des dibayar 5 Jan = bukan rekonsiliasi', px.periodePakaiRekonsiliasiTahunan(pDes), false);
  assertEq('tipe Desember tidak menimpa tanggal bayar Januari', px.periodePakaiRekonsiliasiTahunan({
    tipe_periode: 'desember',
    start: '2026-11-25',
    end: '2026-12-24',
    bayar: '2027-01-05',
  }), false);
  assertEq('bayar 31 Des tetap rekonsiliasi', px.periodePakaiRekonsiliasiTahunan(pDesSameMonth), true);
}

{
  const pJan = {
    id: 1,
    nama: 'Januari 2026',
    start: '2025-12-25',
    end: '2026-01-24',
    bayar: '2026-02-05',
    status: 'tutup',
    tipe_periode: 'normal',
  };
  const px = loadPayrollCore({
    periodes: [pJan, pNov, pDes],
  });
  const k = {
    nik: 'REKON-BAYAR',
    nama: 'Uji bayar bulan berikutnya',
    gapok: 8_000_000,
    ptkp: 'TK0',
    masuk: '2020-01-01',
    tunjangan: [],
    potongan: [],
    natura: [],
    bpjs_aktif: bpjsOff,
  };
  const gNov = px.hitungGaji(k, 'November 2026', { skipResolve: true });
  const gDes = px.hitungGaji(k, 'Desember 2026', { skipResolve: true });
  assertEq('Nov (bayar Des) = masa pajak terakhir', gNov.isMasaPajakTerakhir, true);
  assertEq('Des (bayar Jan) bukan masa pajak terakhir', gDes.isMasaPajakTerakhir, false);
  assert('Nov punya objek rekonsiliasi', !!gNov.reconciliation);
  assertEq('Des tidak merekonsiliasi tahun 2027 kosong', !!gDes.reconciliation, false);
  assert('Des Januari memakai TER, PPh > 0', gDes.pph > 0);
  const terJan = px.hitungPPhBln(gDes.grossPPh, 'TK0', '2027-01-05');
  assertEq('Des bayar Jan = PPh TER bukan 0', gDes.pph, terJan);
}

console.log('Rekon masa pajak dari tanggal bayar: semua tes lulus.');
