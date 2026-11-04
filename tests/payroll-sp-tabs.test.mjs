/**
 * Tab BPJS / Natura di panel komponen gaji harus punya aksi klik yang sama seperti tombol mode.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const html = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');
const events = fs.readFileSync(path.join(ROOT, 'js/sigaji-events.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'js/modules/app-shell.js'), 'utf8');

assert('tab BPJS punya payroll-sp-tab', /data-kgstab="bpjs"[^>]*data-sigaji-action="payroll-sp-tab"/.test(html));
assert('tab Natura punya payroll-sp-tab', /data-kgstab="natura"[^>]*data-sigaji-action="payroll-sp-tab"/.test(html));
assert('tab PPh Return punya payroll-sp-tab', /data-kgstab="pphret"[^>]*data-sigaji-action="payroll-sp-tab"/.test(html));
assert('tab Ringkasan punya payroll-sp-tab', /data-kgstab="ring"[^>]*data-sigaji-action="payroll-sp-tab"/.test(html));
assert('events handle payroll-sp-tab', events.indexOf("case 'payroll-sp-tab'") >= 0);
assert('bind langsung di baris tab', shell.indexOf('function bindPayrollSpTabsOnce') >= 0);
assert('closest tab tanpa selector keturunan id', events.indexOf("t.closest('.spt[data-kgstab]')") >= 0);

console.log('payroll-sp-tabs.test.mjs: all passed');
