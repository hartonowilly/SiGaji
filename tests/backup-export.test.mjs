/**
 * Backup JSON harus memuat template gaji (dan cabang) supaya Restore tidak menghilangkan master itu.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/modules/app-master.js'), 'utf8');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

assert('DATA_KEYS memuat gajiTemplates', /var DATA_KEYS=\[[^\]]*['"]gajiTemplates['"]/.test(SRC));
assert('DATA_KEYS memuat cabang', /var DATA_KEYS=\[[^\]]*['"]cabang['"]/.test(SRC));
assert('export menyalin gajiTemplates', /gajiTemplates:sigajiDeepClone\(/.test(SRC));
assert('export menyalin cabang', /cabang:sigajiDeepClone\(/.test(SRC));

const sandbox = {
  console,
  document: { getElementById: () => ({ value: '' }), addEventListener: function () {} },
  karyawan: [{ nik: 'K1' }],
  periodes: [{
    nama: 'Okt',
    snapshot_locked: true,
    hasil_gaji: { v: 1, byNik: { K1: { neto: 4500000 } } },
    absensi_pot_baseline: { K1: { total: 100, nowTotal: 0, dirty: true, capturedAt: '2026-10-30' } },
  }],
  hariLibur: [],
  masterCuti: {},
  absensi: {},
  lembur: {},
  prorata: {},
  approvals: [],
  notifikasi: [],
  perusahaan: {},
  users: [],
  roles: {},
  thrManual: {},
  tunjVarBulan: {},
  tunjVarLabels: {},
  tunjVarColumns: [],
  karSnapshot: {},
  auditLog: [],
  cabang: [{ id: 'c-sumbawa', nama: 'Sumbawa', umk: 3000000 }],
  gajiTemplates: [{ id: 'gt-1', nama: 'Operator', gapok: 3000000, jabatan: 'Operator' }],
  saveAll: function () {},
  PA: function () {
    return { nama: 'Okt' };
  },
  SIGAJI_APP_LABEL: 'SiGaji',
  SCHEMA_VERSION: 23,
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(SRC, ctx, { filename: 'app-master.js' });
const data = vm.runInContext('buildExportData()', ctx);

assert('file backup berisi array gajiTemplates', Array.isArray(data.gajiTemplates) && data.gajiTemplates.length === 1);
assert('isi template gaji utuh di backup', data.gajiTemplates[0].nama === 'Operator' && data.gajiTemplates[0].gapok === 3000000);
assert('file backup berisi cabang', Array.isArray(data.cabang) && data.cabang[0].id === 'c-sumbawa');
assert(
  'backup JSON memuat hasil beku periode',
  data.periodes[0].hasil_gaji && data.periodes[0].hasil_gaji.byNik.K1.neto === 4500000
);
assert('backup membuang cache nowTotal', data.periodes[0].absensi_pot_baseline.K1.nowTotal == null);
assert('backup membuang dirty', data.periodes[0].absensi_pot_baseline.K1.dirty == null);
assert('backup menyimpan total baseline', data.periodes[0].absensi_pot_baseline.K1.total === 100);
assert('fungsi sanitasi backup ada', typeof sandbox.sigajiBackupSanitizePeriodes === 'function');
assert('checklist backup punya Template gaji', sandbox.DATA_LABELS.gajiTemplates === 'Template gaji');
assert('export JSON bisa disimpan ke cloud', typeof sandbox.jsonBackupSaveToCloud === 'function');
assert('ada tombol Simpan JSON ke cloud', typeof sandbox.exportBackupJsonCloud === 'function');
assert(
  'logo bisa dihapus dari salinan cloud',
  sandbox.jsonBackupStripLogo({ perusahaan: { logo: 'data:image/png;base64,xx' } }).perusahaan.logo === ''
);

console.log('\nBackup export: semua tes lulus.');
