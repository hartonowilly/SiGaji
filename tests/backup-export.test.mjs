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
  periodes: [{ nama: 'Okt' }],
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
assert('checklist backup punya Template gaji', sandbox.DATA_LABELS.gajiTemplates === 'Template gaji');

console.log('\nBackup export: semua tes lulus.');
