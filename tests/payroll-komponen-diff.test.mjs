/**
 * Banding komponen gaji antar periode — tanpa PPh.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

function load() {
  const sandbox = {
    window: {},
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    console,
    fmt: function (n) {
      return 'Rp ' + String(Math.round(n || 0));
    },
  };
  sandbox.window = sandbox;
  const code = fs.readFileSync(path.join(ROOT, 'js/modules/sigaji-payroll-insights.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'sigaji-payroll-insights.js' });
  return sandbox;
}

const s = load();

const prev = s.sigajiPayrollKomponenMap(
  {},
  {
    gapokFull: 5000000,
    tItems: [
      { nama: 'Bonus', eff: 2000000 },
      { nama: 'Uang Makan', eff: 300000 },
    ],
    potT: 100000,
    lb: 0,
    thrBruto: 5000000,
    natKP: 0,
    pph: 800000,
  }
);
const now = s.sigajiPayrollKomponenMap(
  {},
  {
    gapokFull: 5000000,
    tItems: [
      { nama: 'Bonus', eff: 0 },
      { nama: 'Uang Makan', eff: 300000 },
    ],
    potT: 100000,
    lb: 0,
    thrBruto: 0,
    natKP: 0,
    pph: 50000,
  }
);

assert('PPh tidak masuk peta', !prev.pph && !now.pph);
const diffs = s.sigajiPayrollKomponenDiff(prev, now);
assert(
  'bonus terdeteksi turun',
  diffs.some(function (d) {
    return d.label === 'Bonus' && d.from === 2000000 && d.to === 0;
  })
);
assert(
  'THR ikut tercatat di peta',
  diffs.some(function (d) {
    return d.key === 'thr';
  })
);
assert(
  'uang makan tidak berubah',
  !diffs.some(function (d) {
    return /makan/i.test(d.label);
  })
);
assert(
  'gaji pokok tidak berubah',
  !diffs.some(function (d) {
    return d.key === 'gapok';
  })
);

const teks = s.sigajiFmtKomponenDiff(
  diffs.filter(function (d) {
    return d.key !== 'thr';
  })
);
assert('teks menjelaskan bonus, bukan THP', /Bonus/.test(teks) && !/THP|neto/i.test(teks));

const hanyaPph = s.sigajiPayrollKomponenDiff(
  s.sigajiPayrollKomponenMap({}, { gapokFull: 5000000, tItems: [], potT: 0, pph: 100000 }),
  s.sigajiPayrollKomponenMap({}, { gapokFull: 5000000, tItems: [], potT: 0, pph: 900000 })
);
assert('hanya PPh berubah → tidak ada selisih komponen', hanyaPph.length === 0);

console.log('payroll-komponen-diff.test.mjs: all passed');
