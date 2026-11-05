/**
 * Restore backup JSON: hasil beku dan THP sama persis; cache koreksi tidak ikut.
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore();
const k = {
  nik: 'K-BEK',
  nama: 'Backup Beku',
  gapok: 7_500_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: {
    'kes-prs': true,
    'kes-kar': true,
    'jht-prs': true,
    'jht-kar': true,
    'jp-prs': true,
    'jp-kar': true,
    'jkk-prs': true,
    'jkm-prs': true,
  },
};
px.karyawan = [k];
const p = px.periodes.find(function (x) {
  return x.nama === 'Maret 2026';
});
p.snapshot_locked = true;
px.sigajiBekukanHasilPeriode(p, { skipSave: true });
p.absensi_pot_baseline = {
  'K-BEK': { total: 50000, details: [], nowTotal: 0, nowDetails: [], dirty: true, capturedAt: '2026-03-25' },
};
const netoAsli = px.hitungGaji(k, 'Maret 2026').neto;
assertEq('ada hasil beku sebelum backup', !!(p.hasil_gaji && p.hasil_gaji.byNik['K-BEK']), true);

const file = JSON.parse(
  JSON.stringify({
    karyawan: px.karyawan,
    periodes: px.periodes,
  })
);
file.periodes.forEach(function (per) {
  if (!per.absensi_pot_baseline) return;
  Object.keys(per.absensi_pot_baseline).forEach(function (nik) {
    var r = per.absensi_pot_baseline[nik];
    if (!r || typeof r !== 'object') return;
    delete r.nowTotal;
    delete r.nowDetails;
    delete r.nowAt;
    delete r.dirty;
  });
});
assertEq('file backup tanpa nowTotal', file.periodes[0].absensi_pot_baseline['K-BEK'].nowTotal == null ? 1 : 0, 1);
assertEq('file backup tetap total baseline', file.periodes[0].absensi_pot_baseline['K-BEK'].total, 50000);
assertEq('file backup tetap neto beku', file.periodes[0].hasil_gaji.byNik['K-BEK'].neto, netoAsli);

const px2 = loadPayrollCore();
px2.karyawan = file.karyawan;
px2.periodes = file.periodes;
const k2 = px2.karyawan[0];
assertEq('restore: THP sama persis', px2.hitungGaji(k2, 'Maret 2026').neto, netoAsli);
assertEq('restore: PPh beku sama', px2.hitungGaji(k2, 'Maret 2026').pph, p.hasil_gaji.byNik['K-BEK'].pph);

k.gapok = 1;
assertEq('sumber asli terkunci tidak ikut gapok baru', px.hitungGaji(k, 'Maret 2026').neto, netoAsli);

console.log('\nBackup restore freeze: semua tes lulus.');
