/**
 * Tes perbaikan aturan: UPMK, THR, PPh tahunan, absensi, BPJS, natura, lembur, Desember.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
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
const bpjsMati = {
  'kes-prs': false,
  'kes-kar': false,
  'jht-prs': false,
  'jht-kar': false,
  'jp-prs': false,
  'jp-kar': false,
  'jkk-prs': false,
  'jkm-prs': false,
};

const px = loadPayrollCore({
  perusahaan: {
    hariKerja: 6,
    aturan_potongan: {
      cuti_dalam_kuota: { mode: 'tidak_dipotong', nilai: 0 },
      cuti_luar_kuota: { mode: 'prorata', nilai: 0 },
      izin: { mode: 'prorata', nilai: 0 },
      sakit: { mode: 'prorata', nilai: 0 },
      setengah_sakit: { mode: 'prorata_setengah', nilai: 0 },
      setengah_ijin: { mode: 'prorata_setengah', nilai: 0 },
      alpha: { mode: 'prorata', nilai: 0 },
    },
  },
  periodes: [
    {
      id: 1,
      nama: 'Maret 2026',
      start: '2026-03-01',
      end: '2026-03-31',
      bayar: '2026-03-31',
      status: 'aktif',
      thr_aktif: true,
      thr_hariraya: '2026-03-20',
      tipe_periode: 'biasa',
    },
    {
      id: 2,
      nama: 'Desember 2026',
      start: '2026-12-01',
      end: '2026-12-31',
      bayar: '2026-12-31',
      status: 'tutup',
      tipe_periode: 'normal',
    },
  ],
});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/pesangon.js'), 'utf8'), px);

// 1. UPMK tidak dikali faktor
const kPhk = {
  nik: 'PHK-16TH',
  nama: 'Uji PHK',
  gapok: 10_000_000,
  masuk: '2010-03-01',
  tgl_berhenti: '2026-03-01',
  tunjangan: [],
  phk: { alasan: 'pensiun', sisa_cuti_hari: 0 },
};
assertEq('UPMK 16 thn = 6 bulan', px.bulanUPMKPasal41(16 * 12), 6);
assertEq('UPMK pensiun 1×', px.hitungPesangon(kPhk).upmk, 60_000_000);
assertEq('UP pensiun 1,75×', px.hitungPesangon(kPhk).up, Math.round(px.bulanUPPasal40(16 * 12) * 10_000_000 * 1.75));
kPhk.phk.alasan = 'meninggal';
assertEq('UPMK meninggal 1×', px.hitungPesangon(kPhk).upmk, 60_000_000);
kPhk.phk.alasan = 'phk_05x';
assertEq('UPMK efisiensi 1× (bukan 0,5×)', px.hitungPesangon(kPhk).upmk, 60_000_000);
assertEq('UP efisiensi 0,5×', px.hitungPesangon(kPhk).up, Math.round(px.bulanUPPasal40(16 * 12) * 10_000_000 * 0.5));

// 2–3. THR harian ×25; masa kerja sampai hari raya
const kHarian = {
  nik: 'HR-THR',
  nama: 'Harian THR',
  gapok: 150_000,
  siklus_gaji: 'harian',
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsMati,
};
const thrPenuh = px.hitungTHRBruto(kHarian, 'Maret 2026');
assertEq('THR harian 6 thn = 25 hari', thrPenuh.nilai, 3_750_000);
assertEq('masa kerja THR ≥ 12', thrPenuh.mb >= 12, true);

{
  const px5 = loadPayrollCore({ perusahaan: { hariKerja: 5 } });
  const thr5 = px5.hitungTHRBruto(
    { nik: 'HR-THR5', gapok: 150_000, siklus_gaji: 'harian', masuk: '2020-01-01', tunjangan: [], potongan: [], natura: [] },
    'Maret 2026'
  );
  assertEq('THR harian 5 hari kerja = 21 hari', thr5.nilai, 3_150_000);
  const kLb5 = { nik: 'LB-H5', gapok: 150_000, siklus_gaji: 'harian', tunjangan: [] };
  assertEq('upah/jam harian 5hk ×173 = 21 hari', Math.round(px5.upahPerJamDariSiklus(kLb5) * 173), 3_150_000);
}

const kBaru = {
  nik: 'THR-BARU',
  nama: 'Masuk Sep',
  gapok: 10_000_000,
  masuk: '2025-09-15',
  tunjangan: [],
};
const thrBaru = px.hitungTHRBruto(kBaru, 'Maret 2026');
assertEq('masa kerja s.d. 20 Mar = 6 bln', thrBaru.mb, 6);
assertEq('THR 6/12 dari 10jt', thrBaru.nilai, 5_000_000);

px.periodes[0].thr_hariraya = '2026-03-01';
assertEq('kalau dihitung 1 Mar = 5/12', px.hitungTHRBruto(kBaru, 'Maret 2026').mb, 5);
px.periodes[0].thr_hariraya = '2026-03-20';
px.periodes[0].thr_aktif = false;

// 6–7. Alpha mengurangi dasar PPh; tarif harian dari gaji penuh
const kAbs = {
  nik: 'ABS-01',
  nama: 'Alpha',
  gapok: 10_000_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsMati,
};
px.karyawan = [kAbs];
px.absensi = { 'ABS-01': { '2026-03-03': 'alpha', '2026-03-04': 'alpha', '2026-03-05': 'alpha' } };
px.prorata = {};
const gPenuh = px.hitungGaji(kAbs, 'Maret 2026', { skipResolve: true });
const hk = px.hariKerjaRange('2026-03-01', '2026-03-31');
assertEq('gaji harian dari gapok penuh', gPenuh.potKehadiran.gajiHarian, Math.round(10_000_000 / hk));
assertEq('3 hari alpha', gPenuh.potKehadiran.nAlpha, 3);
assertEq('PPh dari bruto setelah alpha', gPenuh.grossPPh, Math.max(0, gPenuh.gapokEff - gPenuh.potKehadiran.total));

px.prorata['ABS-01'] = { 'Maret 2026': { enabled: true, hk: 25, hh: 13, manual: true } };
const gPr = px.hitungGaji(kAbs, 'Maret 2026', { skipResolve: true });
assertEq('alpha saat prorata tetap tarif penuh/HK periode', gPr.potKehadiran.gajiHarian, Math.round(10_000_000 / hk));

// 8. BPJS karyawan baru tidak diprorata; 9 tetap: resign tanpa tunjangan
const kJoin = {
  nik: 'JOIN-01',
  nama: 'Join',
  gapok: 10_000_000,
  ptkp: 'TK0',
  masuk: '2026-03-10',
  tunjangan: [{ nama: 'Jabatan', nilai: 3_000_000, tipe: 'tetap' }],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsAktif,
};
px.karyawan = [kJoin];
px.absensi = {};
px.prorata = { 'JOIN-01': { 'Maret 2026': { enabled: true, hk: 25, hh: 13, manual: true } } };
const gJoin = px.hitungGaji(kJoin, 'Maret 2026', { skipResolve: true });
assertEq('BPJS gapok penuh meski prorata', gJoin.gapokBpjs, 10_000_000);
assertEq('JHT kar 2% dari 13jt', gJoin.bpjs.jht_kar, 260_000);

const kResBpjs = Object.assign({}, kJoin, {
  nik: 'RES-BPJS',
  masuk: '2020-01-01',
  tgl_berhenti: '2026-03-15',
  phk: { alasan: 'resign_30hr' },
});
px.karyawan = [kResBpjs];
px.prorata = {};
const gRes = px.hitungGaji(kResBpjs, 'Maret 2026', { skipResolve: true });
assertEq('resign: tunjangan tidak masuk BPJS', gRes.bpjs.jht_kar, 200_000);

// 11. Natura tidak ditransfer
const kNat = {
  nik: 'NAT-01',
  nama: 'Natura',
  gapok: 8_000_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [
    { nama: 'Makan kantor', nilai: 500_000, kp: false },
    { nama: 'Mobil', nilai: 1_000_000, kp: true },
  ],
  bpjs_aktif: bpjsMati,
};
const gNat = px.hitungGaji(kNat, 'Maret 2026', { skipResolve: true });
assertEq('NKP tidak masuk THP', gNat.brutoTH, 8_000_000);
assertEq('KP tetap masuk dasar PPh', gNat.natKP, 1_000_000);
assertEq('NKP tercatat tapi tidak cair', gNat.natNKP, 500_000);

// 12. Lembur: (gapok + tetap) / 173; harian ×25 / 173
const kLb = {
  nik: 'LB-TETAP',
  nama: 'Lembur',
  gapok: 5_190_000,
  tunjangan: [{ nama: 'Tetap', nilai: 1_730_000, tipe: 'tetap' }],
};
assertEq('upah/jam termasuk tunj tetap', Math.round(px.upahPerJamDariSiklus(kLb)), 40_000);
const kLbH = { nik: 'LB-H', gapok: 150_000, siklus_gaji: 'harian', tunjangan: [] };
assertEq('upah/jam harian ×173 = 25 hari', Math.round(px.upahPerJamDariSiklus(kLbH) * 173), 3_750_000);

// 13. Desember terdeteksi dari tanggal bayar meski tipe Normal
assertEq('Desember kalender = rekonsiliasi', px.periodePakaiRekonsiliasiTahunan(px.periodes[1]), true);
const kDes = {
  nik: 'DES-AUTO',
  nama: 'Des',
  gapok: 8_000_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsMati,
};
const gDes = px.hitungGaji(kDes, 'Desember 2026', { skipResolve: true });
assertEq('Desember Normal tetap masa pajak terakhir', gDes.isMasaPajakTerakhir, true);

console.log('\nAturan kritis: semua tes lulus.');
