/**
 * Riwayat PWA: pushState/popstate di showPg, modal, panel, kartu.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const hist = fs.readFileSync(path.join(ROOT, 'js/pwa-history.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'js/modules/app-shell.js'), 'utf8');
const komponen = fs.readFileSync(path.join(ROOT, 'js/modules/app-hr-komponen.js'), 'utf8');
const pg = fs.readFileSync(path.join(ROOT, 'js/modules/app-hr-payroll.js'), 'utf8');
const kar = fs.readFileSync(path.join(ROOT, 'js/modules/app-hr.js'), 'utf8');
const tpl = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');
const eb = fs.readFileSync(path.join(ROOT, 'js/modules/ebupot-export.js'), 'utf8');

assert('pwa-history popstate + pushState', /addEventListener\('popstate'/.test(hist) && /history\.pushState/.test(hist) && /sigajiHistCloseTopLayer/.test(hist));
assert('showPg menambah riwayat', /sigajiHistPush\(\{sigaji:'pg'/.test(shell));
assert('openModal/closeModal riwayat', /sigajiHistPush\(\{sigaji:'modal'/.test(shell) && /history\.back\(\)/.test(shell));
assert('panel profil/gaji push', /sigaji:'panel',kind:'kar'/.test(komponen) && /sigaji:'panel',kind:'payroll'/.test(komponen));
assert('kartu HP push', /sigaji:'card',kind:'gaji'/.test(pg) && /sigaji:'card',kind:'kar'/.test(kar));
assert('template memuat pwa-history', /pwa-history\.js/.test(tpl));
assert('THR e-Bupot dipisah masa bayar', /ebupotBagianUntukMasa/.test(eb) && /ebupotMasaThrFromPeriode/.test(eb));

console.log('pwa-history.test.mjs: all passed');
