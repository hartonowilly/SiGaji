/**
 * NPWP 16, kode objek Coretax, BPA1, pesangon BP21,
 * mingguan prorata masuk/alpha, TER harian tidak tetap, cuti kuota.
 */
import { loadPayrollCore, loadEbupotExport } from './lib/payroll-harness.mjs';

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

const PERIODE = 'Maret 2026';
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

function karBase(extra) {
  return {
    nik: 'TES-X',
    nama: 'Uji',
    gapok: 0,
    ptkp: 'TK0',
    masuk: '2020-01-01',
    tunjangan: [],
    potongan: [],
    natura: [],
    bpjs_aktif: bpjsOff,
    ...extra,
  };
}

{
  const px = loadEbupotExport();
  assertEq('NPWP 15 → 16 prepend 0', px.ebupotNpwp16('029482015507000'), '0029482015507000');
  assertEq('NPWP 16 tetap', px.ebupotNpwp16('0029482015507000'), '0029482015507000');
  assertEq(
    'tetap = 21-100-01',
    px.ebupotKodeObjek({ tipe_kerja: 'tetap', siklus_gaji: 'bulanan', gapok: 8e6 }),
    '21-100-01'
  );
  assertEq(
    'tidak tetap bulanan = 21-100-35',
    px.ebupotKodeObjek({ tipe_kerja: 'tidak_tetap', siklus_gaji: 'bulanan', gapok: 5e6 }),
    '21-100-35'
  );
  assertEq(
    'tidak tetap harian 500rb = 21-100-24',
    px.ebupotKodeObjek({ tipe_kerja: 'tidak_tetap', siklus_gaji: 'harian', gapok: 500000 }),
    '21-100-24'
  );
  assertEq(
    'tidak tetap harian 3jt = 21-100-30',
    px.ebupotKodeObjek({ tipe_kerja: 'tidak_tetap', siklus_gaji: 'harian', gapok: 3000000 }),
    '21-100-30'
  );
}

{
  const px = loadEbupotExport();
  const bpmp = px.ebupotBuildMmPayrollXml({
    npwpPemotong: '0029482015507000',
    rows: [
      {
        tipeKerja: 'tetap',
        masaPajakTerakhir: false,
        masaBulan: 3,
        masaTahun: '2026',
        statusPegawai: 'Resident',
        counterpartTin: '3275010905770021',
        ptkp: 'TK/0',
        jabatan: 'Staff',
        fasilitas: 'N/A',
        kodeObjek: '21-100-01',
        penghasilanBruto: 8000000,
        tarifTerPct: 5,
        idTkuPemotong: '0029482015507000000000',
        withholdingDate: '2026-03-25',
        npwpPemotong: '0029482015507000',
      },
      {
        tipeKerja: 'tetap',
        masaPajakTerakhir: true,
        kodeObjek: '21-100-01',
      },
    ],
  });
  assert('BPMP hanya non-masa-terakhir', bpmp.ok && bpmp.count === 1);
  assert('BPMP bukan Rate rekonsiliasi', bpmp.xml.indexOf('<Rate>5</Rate>') >= 0);

  const bpa1 = px.ebupotBuildBpa1Xml({
    npwpPemotong: '0029482015507000',
    rows: [
      {
        tipeKerja: 'tetap',
        masaPajakTerakhir: true,
        masaBulan: 12,
        masaTahun: '2026',
        statusPegawai: 'Resident',
        counterpartTin: '3275010905770021',
        ptkp: 'TK/0',
        jabatan: 'Staff',
        fasilitas: 'N/A',
        kodeObjek: '21-100-01',
        startPeriod: 1,
        endPeriod: 12,
        brutoTahunan: 96000000,
        pphTahunan: 2500000,
        penghasilanBruto: 8000000,
        pphDipotong: 400000,
        idTkuPemotong: '0029482015507000000000',
        withholdingDate: '2026-12-25',
        npwpPemotong: '0029482015507000',
      },
    ],
  });
  assert('BPA1 ada', bpa1.ok && bpa1.count === 1);
  assert('BPA1 Income tahunan', bpa1.xml.indexOf('<Income>96000000</Income>') >= 0);
  assert('BPA1 Tax rekonsiliasi', bpa1.xml.indexOf('<Tax>2500000</Tax>') >= 0);
  assert('BPA1 Rate nil', bpa1.xml.indexOf('Rate xsi:nil="true"') >= 0);

  const bp21 = px.ebupotBuildBp21Xml({
    npwpPemotong: '0029482015507000',
    rows: [
      {
        tipeKerja: 'pesangon',
        masaBulan: 3,
        masaTahun: '2026',
        counterpartTin: '3275010905770021',
        idTkuPenerima: '3275010905770021000000',
        ptkp: 'TK/0',
        fasilitas: 'N/A',
        kodeObjek: '21-401-01',
        penghasilanBruto: 80000000,
        tarifTerPct: 1.88,
        periodeGaji: 'Maret 2026',
        withholdingDate: '2026-03-25',
        idTkuPemotong: '0029482015507000000000',
        npwpPemotong: '0029482015507000',
      },
    ],
  });
  assert('pesangon masuk BP21', bp21.ok && bp21.xml.indexOf('21-401-01') >= 0);
  assert('pesangon Rate nil (tarif berlapis Coretax)', bp21.xml.indexOf('Rate xsi:nil="true"') >= 0);
  assert('pesangon bukan Rate 1.88', bp21.xml.indexOf('<Rate>1.88</Rate>') < 0);
}

{
  const px = loadPayrollCore();
  const k = karBase({
    nik: 'TES-MG-JOIN',
    gapok: 1_200_000,
    siklus_gaji: 'mingguan',
    masuk: '2026-03-04',
  });
  const pays = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  const first = pays[0];
  assertEq('join Rabu payday Jumat pertama', first.tgl, '2026-03-06');
  assertEq('prorata 3/6 minggu pertama', first.upah, 600_000);
  assert('minggu berikutnya penuh', pays[1] && pays[1].upah === 1_200_000);
}

{
  const px = loadPayrollCore();
  const k = karBase({ nik: 'TES-MG-A', gapok: 1_500_000, siklus_gaji: 'mingguan' });
  const abs = { '2026-03-02': 'alpha', '2026-03-03': 'alpha' };
  const full = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  const pot = px.siklusBuildPays(k, px.periodes[0], 6, {}, abs);
  const totFull = full.reduce(function (s, p) { return s + p.upah; }, 0);
  const totPot = pot.reduce(function (s, p) { return s + p.upah; }, 0);
  assertEq('mingguan tanpa alpha 4×1,5jt', totFull, 6_000_000);
  assertEq('dua hari alpha potong 2/6 minggu', totPot, 6_000_000 - 500_000);
}

{
  const px = loadPayrollCore({
    perusahaan: {
      hariKerja: 6,
      aturan_potongan: {
        cuti_dalam_kuota: { mode: 'tidak_dipotong', nilai: 0 },
        sakit: { mode: 'tidak_dipotong', nilai: 0 },
        alpha: { mode: 'prorata', nilai: 0 },
      },
    },
  });
  const k = karBase({ nik: 'TES-MG-CUTI', gapok: 1_200_000, siklus_gaji: 'mingguan' });
  const full = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  const totFull = full.reduce(function (s, p) { return s + p.upah; }, 0);
  const cuti = px.siklusBuildPays(k, px.periodes[0], 6, {}, { '2026-03-02': 'cuti' });
  const totCuti = cuti.reduce(function (s, p) { return s + p.upah; }, 0);
  assertEq('cuti tahunan mingguan tetap dibayar', totCuti, totFull);
  const sakit = px.siklusBuildPays(k, px.periodes[0], 6, {}, { '2026-03-02': 'sakit' });
  const totSakit = sakit.reduce(function (s, p) { return s + p.upah; }, 0);
  assertEq('sakit tidak_dipotong: mingguan tidak potong', totSakit, totFull);
}

{
  const px = loadPayrollCore();
  const k = karBase({ nik: 'TES-MG-GAP', gapok: 1_200_000, siklus_gaji: 'mingguan' });
  const full = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  const totFull = full.reduce(function (s, p) { return s + p.upah; }, 0);
  const gap = px.siklusBuildPays(k, px.periodes[0], 6, {}, { '2026-02-23': 'alpha' });
  const totGap = gap.reduce(function (s, p) { return s + p.upah; }, 0);
  assertEq('alpha celah 23 Feb potong Jumat 27 Feb', totGap, totFull - 200_000);
}

{
  const px = loadPayrollCore();
  const k = karBase({
    nik: 'TES-MG-JOIN-GAP',
    gapok: 1_200_000,
    siklus_gaji: 'mingguan',
    masuk: '2026-02-23',
  });
  const pays = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  assertEq('join Senin celah 23 Feb payday 27 Feb', pays[0].tgl, '2026-02-27');
  assertEq('prorata 5/6 join sebelum awal periode', pays[0].upah, 1_000_000);
}

{
  const px = loadPayrollCore({
    masterCuti: { kuota: 1, cbPotong: false, hakBaru: 'langsung' },
    perusahaan: {
      hariKerja: 6,
      aturan_potongan: {
        cuti_dalam_kuota: { mode: 'tidak_dipotong', nilai: 0 },
        cuti_luar_kuota: { mode: 'prorata', nilai: 0 },
      },
    },
  });
  const k = karBase({ nik: 'TES-MG-CLK', gapok: 1_200_000, siklus_gaji: 'mingguan' });
  const full = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  const totFull = full.reduce(function (s, p) { return s + p.upah; }, 0);
  const cuti3 = px.siklusBuildPays(k, px.periodes[0], 6, {}, {
    '2026-03-02': 'cuti',
    '2026-03-03': 'cuti',
    '2026-03-04': 'cuti',
  });
  const totCuti3 = cuti3.reduce(function (s, p) { return s + p.upah; }, 0);
  assertEq('3 cuti kuota 1: bayar 1 potong 2', totCuti3, totFull - 400_000);
}

{
  const px = loadPayrollCore({
    masterCuti: { kuota: 2, cbPotong: true, hakBaru: 'langsung' },
    hariLibur: [{ tgl: '2026-02-16', nama: 'Cuti Bersama', tipe: 'cuti-bersama' }],
    perusahaan: {
      hariKerja: 6,
      aturan_potongan: {
        cuti_dalam_kuota: { mode: 'tidak_dipotong', nilai: 0 },
        cuti_luar_kuota: { mode: 'prorata', nilai: 0 },
      },
    },
  });
  const k = karBase({ nik: 'TES-MG-CB-C', gapok: 1_200_000, siklus_gaji: 'mingguan' });
  const full = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  const totFull = full.reduce(function (s, p) { return s + p.upah; }, 0);
  const mixed = px.siklusBuildPays(k, px.periodes[0], 6, {}, {
    '2026-02-16': 'cuti',
    '2026-03-10': 'cuti',
  });
  const totMixed = mixed.reduce(function (s, p) { return s + p.upah; }, 0);
  assertEq('C di cuti bersama tidak dobel kuota mingguan', totMixed, totFull);
}

{
  const px = loadPayrollCore({
    masterCuti: { kuota: 1, cbPotong: false, hakBaru: 'langsung' },
    perusahaan: {
      hariKerja: 6,
      aturan_potongan: {
        cuti_dalam_kuota: { mode: 'tidak_dipotong', nilai: 0 },
        cuti_luar_kuota: { mode: 'prorata', nilai: 0 },
      },
    },
  });
  const k = karBase({
    nik: 'TES-MG-CUTI-JOIN',
    gapok: 1_200_000,
    siklus_gaji: 'mingguan',
    masuk: '2026-03-01',
  });
  const full = px.siklusBuildPays(k, px.periodes[0], 6, {}, {});
  const totFull = full.reduce(function (s, p) { return s + p.upah; }, 0);
  const mixed = px.siklusBuildPays(k, px.periodes[0], 6, {}, {
    '2026-02-10': 'cuti',
    '2026-03-10': 'cuti',
  });
  const totMixed = mixed.reduce(function (s, p) { return s + p.upah; }, 0);
  assertEq('cuti sebelum masuk tidak makan kuota mingguan', totMixed, totFull);
}

{
  const px = loadPayrollCore();
  const k = karBase({
    nik: 'TES-HR-TT',
    gapok: 500_000,
    siklus_gaji: 'harian',
    tipe_kerja: 'tidak_tetap',
  });
  const g = px.hitungGaji(k, PERIODE, { skipResolve: true });
  const hk = px.hariKerjaRange('2026-02-25', '2026-03-24');
  assertEq('TER harian 0,5% × 500rb × hari', g.pph, Math.round(500_000 * 0.005) * hk);
  assert('bukan TER bulanan 5%', g.pph < 200_000);
}

{
  const px = loadPayrollCore({
    masterCuti: { kuota: 12, cbPotong: true, hakBaru: 'langsung' },
    absensi: {
      TES1: { '2026-03-02': 'cuti', '2026-11-10': 'cuti' },
    },
    hariLibur: [{ tgl: '2026-03-20', nama: 'CB setelah resign', tipe: 'cuti-bersama' }],
    karyawan: [
      {
        nik: 'TES1',
        nama: 'Cuti',
        masuk: '2020-01-01',
        gapok: 6_000_000,
        ptkp: 'TK0',
        tunjangan: [],
        potongan: [],
        natura: [],
        bpjs_aktif: bpjsOff,
      },
      {
        nik: 'TES-RES',
        nama: 'Resign',
        masuk: '2020-01-01',
        tgl_berhenti: '2026-03-10',
        gapok: 6_000_000,
        ptkp: 'TK0',
        tunjangan: [],
        potongan: [],
        natura: [],
        bpjs_aktif: bpjsOff,
      },
    ],
  });
  const p = px.periodes[0];
  const nCuti = px.cutiManualUntukTahunDanPeriode('TES1', 2026, p);
  assertEq('cuti November tidak masuk Maret', nCuti, 1);
  assertEq('cuti bersama setelah resign tidak dihitung', px.countCutiBersama(2026, 'TES-RES'), 0);

  const baru = karBase({ nik: 'BARU', masuk: '2026-03-01' });
  px.masterCuti.hakBaru = 'langsung';
  assertEq('hak langsung 12', px.kuotaCutiKaryawan(baru, 2026), 12);
  px.masterCuti.hakBaru = 'setelah_12bln';
  assertEq('hak setelah 12 bulan = 0', px.kuotaCutiKaryawan(baru, 2026), 0);
  px.masterCuti.hakBaru = 'prorata';
  assert(
    'hak prorata < 12',
    px.kuotaCutiKaryawan(baru, 2026) < 12 && px.kuotaCutiKaryawan(baru, 2026) >= 0
  );
}

{
  const pxE = loadEbupotExport();
  const kar = karBase({
    nik: 'E-PTKP',
    nama: 'Eko',
    gapok: 8_000_000,
    ptkp: 'K0',
    ptkp_berlaku: '2026-07-01',
    ptkp_riwayat: [{ berlakuMulai: '1970-01-01', ptkp: 'TK0' }],
    npwp: '1234567890123456',
    tipe_kerja: 'tetap',
  });
  pxE.karyawan = [kar];
  assertEq('Maret hitung tetap TK0 meski profil K0', pxE.hitungGaji(kar, PERIODE).ptkpStatus, 'TK0');
  const built = pxE.ebupotBuildRows(pxE.periodes[0]);
  assert('e-Bupot baris terbuat', !!(built && built.ok && built.rows && built.rows[0]));
  assertEq('e-Bupot StatusTaxExemption dari periode, bukan profil', built.rows[0].ptkp, 'TK/0');
}

console.log('Semua tes e-Bupot/cuti/mingguan lulus.');
