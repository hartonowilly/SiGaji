/**
 * Dashboard layar pertama: status + daftar perlu tindakan.
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
    document: { getElementById: () => null, querySelector: () => null },
    console,
    CU: { role: 'HRD', cabangId: 'c-sumbawa' },
    approvals: [],
    absensi: {},
    tunjVarColumns: [{ id: 'v2', nama: 'Uang Makan' }],
    tunjVarBulan: {},
    escapeHtml: function (s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
    fmt: function (n) {
      return 'Rp ' + String(Math.round(n || 0));
    },
  };
  sandbox.window = sandbox;
  const code = fs.readFileSync(path.join(ROOT, 'js/modules/sigaji-dash-brief.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'sigaji-dash-brief.js' });
  return sandbox;
}

const s = load();

const lineOpen = s.sigajiDashStatusLine({
  nama: 'Oktober 2026',
  bayar: '2099-12-31',
  snapshot_locked: false,
});
assert('status belum dikunci', /Oktober 2026/.test(lineOpen) && /belum dikunci/.test(lineOpen));
assert('status tidak pakai kata selesai', !/selesai/i.test(lineOpen));

const lineLock = s.sigajiDashStatusLine({
  nama: 'Oktober 2026',
  bayar: '2099-12-31',
  snapshot_locked: true,
});
assert('status terkunci', lineLock === 'Oktober 2026 · terkunci');

const p = { nama: 'Oktober 2026', bayar: '2099-12-01', snapshot_locked: false };
const list = [
  { nik: '1', nama: 'Ani', norek: '', gapok: 0 },
  { nik: '2', nama: 'Budi', norek: '123', gapok: 3000000 },
];

const items = s.sigajiCollectDashTindakan({
  p: p,
  list: list,
  branchHrd: true,
  pendingAp: 2,
  anomalies: [
    { code: 'no_tax_id', severity: 'high', nik: '1', nama: 'Ani' },
    { code: 'no_tax_id', severity: 'high', nik: '2', nama: 'Budi' },
  ],
  deadlines: [
    { cat: 'bpjs', label: 'Iuran BPJS', days: 2 },
    { cat: 'payroll', label: 'Bayar gaji — Oktober 2026', days: 3 },
  ],
});

const ids = items.map(function (x) {
  return x.id;
});
assert('ada rekening kosong', ids.indexOf('norek') >= 0);
assert('ada gapok 0', ids.indexOf('gapok') >= 0);
assert('ada cuti pending', ids.indexOf('cuti') >= 0);
assert('anomali NPWP digabung', items.some(function (x) {
  return x.id === 'anom-no_tax_id' && /2 karyawan/.test(x.text) && /NPWP/.test(x.text);
}));
assert('HRD cabang tidak kebanjiran BPJS HQ', ids.indexOf('dl-0') < 0);
assert('deadline bayar gaji tetap muncul', items.some(function (x) {
  return /Bayar gaji/.test(x.text);
}));

const empty = s.sigajiCollectDashTindakan({
  p: p,
  list: [{ nik: '9', nama: 'Cici', norek: '99', gapok: 4000000 }],
  branchHrd: true,
  pendingAp: 0,
  anomalies: [],
  deadlines: [{ cat: 'bpjs', label: 'Iuran BPJS', days: 2 }],
});
assert('kosong jika beres', empty.length === 0);

console.log('dash-brief.test.mjs: all passed');
