/**
 * PWA: manifest, ikon, service worker, petunjuk pasang.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const tpl = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');
const mob = fs.readFileSync(path.join(ROOT, 'mobile', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pwa = fs.readFileSync(path.join(ROOT, 'js', 'pwa-install.js'), 'utf8');
const payMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const absMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'mobile', 'manifest.webmanifest'), 'utf8'));
const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');

assert('payroll manifest standalone + ikon 192/512', payMan.display === 'standalone' && payMan.start_url === '/' && payMan.icons.some(function (i) { return i.sizes === '192x192'; }) && payMan.icons.some(function (i) { return i.sizes === '512x512'; }));
assert('absen manifest scope /mobile/', absMan.start_url === '/mobile/' && absMan.scope === '/mobile/' && absMan.display === 'standalone');
assert('template payroll PWA tags', /rel="manifest" href="\/manifest.webmanifest"/.test(tpl) && /apple-touch-icon/.test(tpl) && /id="sigaji-pwa-banner"/.test(tpl) && /pwa-install\.js/.test(tpl));
assert('absen PWA tags', /rel="manifest" href="\/mobile\/manifest.webmanifest"/.test(mob) && /apple-touch-icon/.test(mob) && /pwa-install\.js/.test(mob) && /id="sigaji-pwa-banner"/.test(mob));
assert('SW passthrough fetch GET', /skipWaiting/.test(sw) && /addEventListener\('fetch'/.test(sw) && /method !== 'GET'/.test(sw));
assert('pwa-install daftar /sw.js', /serviceWorker\.register\('\/sw\.js'\)/.test(pwa) && /beforeinstallprompt/.test(pwa) && /data-sigaji-pwa/.test(pwa));
assert('hint Nanti terpisah gaji vs absen', /sigaji_pwa_hint_dismissed_gaji/.test(pwa) && /sigaji_pwa_hint_dismissed_absen/.test(pwa));
assert('sw.js tidak di-cache lama', /\/sw\.js/.test(headers) && /no-store/.test(headers));

['sigaji-180.png', 'sigaji-192.png', 'sigaji-512.png', 'sigaji-maskable-192.png', 'sigaji-maskable-512.png'].forEach(function (name) {
  const p = path.join(ROOT, 'icons', 'pwa', name);
  const dim = pngSize(p);
  const want = name.indexOf('180') >= 0 ? 180 : name.indexOf('192') >= 0 ? 192 : 512;
  assert('ikon ' + name, dim.w === want && dim.h === want);
});

console.log('pwa-install.test.mjs: all passed');
