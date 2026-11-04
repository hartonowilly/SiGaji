/**
 * Temuan audit: carryover PPh, migrasi dobel, sisa potongan vs THP, lapis 35%, TER harian extra.
 * node tests/audit-payroll-fix.test.mjs
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

const bpjsOff = {
  'kes-prs': false, 'kes-kar': false, 'jht-prs': false, 'jht-kar': false,
  'jp-prs': false, 'jp-kar': false, 'jkk-prs': false, 'jkm-prs': false,
};

{
  const px = loadPayrollCore();
  const pph49 = px.hitungPPhTahunanProgresif(4_900_000_000, 'TK0', '2026-12-31');
  const pph60 = px.hitungPPhTahunanProgresif(6_000_000_000, 'TK0', '2026-12-31');
  assert('lapis 35% membuat PPh 6M > PPh 4,9M', pph60 > pph49);
  assertEq('PPh tahunan TK0 bruto 6M (HPP 35%)', pph60, 1_773_000_000);
}

{
  const px = loadPayrollCore({
    periodes: [
      { id: 1, nama: 'Januari 2027', start: '2027-01-01', end: '2027-01-31', bayar: '2027-01-28', status: 'aktif' },
    ],
  });
  const k0 = {
    nik: 'CR-0', nama: 'Tanpa kredit', gapok: 10_000_000, ptkp: 'TK0', masuk: '2020-01-01',
    tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
  };
  const k1 = Object.assign({}, k0, {
    nik: 'CR-1', nama: 'Ada kredit',
    pph_lebih_bayar_bawa: { tahun: 2027, nilai: 50_000, sumberTahun: 2026 },
  });
  const g0 = px.hitungGaji(k0, 'Januari 2027', { skipResolve: true });
  const g1 = px.hitungGaji(k1, 'Januari 2027', { skipResolve: true });
  assertEq('PPh 21 Januari tidak berubah', g1.pph, g0.pph);
  assertEq('lebih bayar tahun lalu cair di THP', g1.refundPphBawa, 50_000);
  assertEq('THP Januari naik 50rb', g1.neto, g0.neto + 50_000);
}

{
  const px = loadPayrollCore({
    periodes: [
      {
        id: 1, nama: 'Des 2026', start: '2026-12-01', end: '2026-12-31', bayar: '2026-12-25',
        status: 'aktif', tipe_periode: 'desember', opsi_lebih_bayar: 'carryover',
      },
      {
        id: 2, nama: 'Jan 2027', start: '2027-01-01', end: '2027-01-31', bayar: '2027-01-28',
        status: 'aktif',
      },
    ],
    karyawan: [],
    karSnapshot: {},
  });
  const k = {
    nik: 'CR-P', nama: 'Carry persist', gapok: 8_000_000, ptkp: 'TK0', masuk: '2020-01-01',
    tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
    pph_ytd_awal: { 2026: { bruto: 88_000_000, pph: 2_675_850, sd_bulan: 11 } },
  };
  px.karyawan.push(k);
  const gDes = px.hitungGaji(k, 'Des 2026');
  const lebih = gDes.reconciliation && gDes.reconciliation.lebihBayar;
  assert('Desember ada lebih bayar', lebih > 0);
  assertEq('Desember carryover tidak masuk THP', gDes.refundPph, 0);
  const slot = px.karyawan[0].pph_lebih_bayar_bawa;
  assertEq('saldo tersimpan di karyawan asli', slot && slot.tahun, 2027);
  assertEq('nilai carryover = lebih bayar Desember', slot && slot.nilai, lebih);
  const kJan = {
    nik: 'CR-JAN0', nama: 'Tanpa bawa', gapok: 8_000_000, ptkp: 'TK0', masuk: '2020-01-01',
    tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
  };
  const g0 = px.hitungGaji(kJan, 'Jan 2027', { skipResolve: true });
  const g1 = px.hitungGaji(k, 'Jan 2027');
  assertEq('PPh 21 Januari tidak diubah carryover', g1.pph, g0.pph);
  assertEq('Januari cair ke THP', g1.refundPphBawa, lebih);
  assertEq('THP Januari + lebih bayar', g1.neto, g0.neto + lebih);
  const copy = Object.assign({}, k);
  delete copy.pph_lebih_bayar_bawa;
  const gCopy = px.hitungGaji(copy, 'Jan 2027', { skipResolve: true });
  assertEq('salinan periode tetap cair dari master', gCopy.refundPphBawa, lebih);
}

{
  const px = loadPayrollCore({
    periodes: [
      { id: 1, nama: 'April 2026', start: '2026-04-01', end: '2026-04-30', bayar: '2026-04-25', status: 'tutup' },
      { id: 2, nama: 'Mei 2026', start: '2026-05-01', end: '2026-05-31', bayar: '2026-05-25', status: 'tutup' },
      { id: 3, nama: 'Desember 2026', start: '2026-12-01', end: '2026-12-31', bayar: '2026-12-25', status: 'aktif' },
    ],
  });
  const k = {
    nik: 'MIG-1', nama: 'Migrasi', gapok: 8_000_000, ptkp: 'TK0', masuk: '2020-01-01',
    tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff,
    pph_ytd_awal: { 2026: { bruto: 32_000_000, pph: 400_000, sd_bulan: 4 } },
  };
  assert('April tumpang saldo', px.periodeTumpangSaldoMigrasi(k, px.periodes[0]));
  assert('Mei tidak tumpang', !px.periodeTumpangSaldoMigrasi(k, px.periodes[1]));
  const ytd = px.getBrutoYTD(k, 'Desember 2026');
  const gMei = px.hitungGaji(k, 'Mei 2026', { skipResolve: true });
  assertEq('YTD tidak dobel April', ytd.totalBruto, 32_000_000 + gMei.grossPPh);
  assertEq('YTD PPh saldo + Mei', ytd.totalPPh, 400_000 + gMei.pph);
}

{
  const px = loadPayrollCore({
    periodes: [
      { id: 1, nama: 'Dua Hari', start: '2026-10-01', end: '2026-10-02', bayar: '2026-10-02', status: 'aktif' },
    ],
  });
  const k = {
    nik: 'HR-SISA', nama: 'Harian sisa', gapok: 150_000, siklus_gaji: 'harian', ptkp: 'TK0', masuk: '2020-01-01',
    tunjangan: [], potongan: [{ nama: 'Bon', nilai: 400_000 }], natura: [], bpjs_aktif: bpjsOff,
  };
  const g = px.hitungGaji(k, 'Dua Hari', { skipResolve: true });
  assert('ada sisa potongan', g.jadwalBayar && g.jadwalBayar.sisaPotongan > 0);
  assert('THP tidak minus karena sisa utang', g.neto >= 0);
}

{
  const extra = pxHit();
  function pxHit() {
    return loadPayrollCore().hitungPPhTerHarianDariPays(
      [{ tgl: '2026-03-02', upah: 400_000 }],
      100_000,
      'TK0',
      '2026-03-25'
    );
  }
  assertEq('extra harian ikut TER harian 0,5%', extra.pph, Math.round(500_000 * 0.005));
}

{
  const px = loadEbupotExport({
    periodes: [
      { id: 1, nama: 'Awal Des', start: '2026-12-01', end: '2026-12-15', bayar: '2026-12-20', status: 'tutup' },
      { id: 2, nama: 'Akhir Des', start: '2026-12-16', end: '2026-12-31', bayar: '2026-12-28', status: 'aktif' },
    ],
    karyawan: [
      {
        nik: 'EB-1', nama: 'Gabung', gapok: 8_000_000, ptkp: 'TK0', masuk: '2020-01-01',
        tunjangan: [], potongan: [], natura: [], bpjs_aktif: bpjsOff, tipe_kerja: 'tidak_tetap',
      },
    ],
  });
  const built = px.ebupotBuildRows(px.periodes[1]);
  assert('ok gabung masa', built.ok);
  assert('peringatan gabung periode', built.warnings.some(function (w) { return String(w).indexOf('menggabungkan') >= 0; }));
}

{
  const px = loadPayrollCore({ perusahaan: { hariKerja: 5 } });
  const ctx = px;
  const fs = await import('fs');
  const path = await import('path');
  const vm = await import('vm');
  const { fileURLToPath } = await import('url');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/pesangon.js'), 'utf8'), ctx);
  const r = ctx.hitungPesangon({
    nik: 'PHK-5', nama: 'Lima hari', gapok: 5_250_000, masuk: '2010-01-01', tgl_berhenti: '2026-06-30',
    tunjangan: [], phk: { alasan: 'phk_uu', sisa_cuti_hari: 1 },
  });
  assertEq('UPH 5 hari kerja = dasar/21', r.uph, 250_000);
}

console.log('\nAudit payroll fix: semua tes lulus.');
