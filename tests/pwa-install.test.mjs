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
assert('template payroll PWA tags', /rel="manifest" href="\/manifest.webmanifest"/.test(tpl) && /apple-touch-icon/.test(tpl) && /sigaji-pwa-banner/.test(tpl) && /pwa-install\.js/.test(tpl));
assert('absen PWA tags', /rel="manifest" href="\/mobile\/manifest.webmanifest"/.test(mob) && /apple-touch-icon/.test(mob) && /pwa-install\.js/.test(mob) && /sigaji-pwa-banner/.test(mob));
assert('SW cadangan offline navigate', /SIGAJI_OFFLINE_PAGE = '\/offline'/.test(sw) && /mode === 'navigate'/.test(sw) && /method !== 'GET'/.test(sw) && !/SIGAJI_OFFLINE_URLS/.test(sw));
assert('pwa-install daftar /sw.js', /serviceWorker\.register\('\/sw\.js'\)/.test(pwa) && /beforeinstallprompt/.test(pwa) && /data-sigaji-pwa/.test(pwa));
assert('hint Nanti hanya sesi ini', /sessionStorage/.test(pwa) && /sigaji_pwa_hint_session_gaji/.test(pwa) && /sigaji_pwa_hint_session_absen/.test(pwa));
assert('teks iOS Tambah ke Layar Utama', /Tambah ke Layar Utama/.test(tpl) && /login ulang/.test(tpl));
assert('manifest tidak kunci portrait', payMan.orientation == null && absMan.orientation == null);
assert('Muat ulang di topbar', /sigajiReloadApp/.test(tpl));
const save = fs.readFileSync(path.join(ROOT, 'js/sigaji-save-file.js'), 'utf8');
assert('simpan file Bagikan di iOS standalone', /sigajiSaveFile/.test(save) && /canShare/.test(save) && /sigajiWriteXlsx/.test(save));
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const cssMob = fs.readFileSync(path.join(ROOT, 'css/sigaji-mobile-web.css'), 'utf8');
const offHtml = fs.readFileSync(path.join(ROOT, 'offline.html'), 'utf8');
const offJs = fs.readFileSync(path.join(ROOT, 'js/offline-retry.js'), 'utf8');
const hist = fs.readFileSync(path.join(ROOT, 'js/pwa-history.js'), 'utf8');
assert('isian BPJS 16px hanya HP', !/\.bi\{[^}]*font-size:16px/.test(css) && /html\.sigaji-mobile-nav \.bi[\s\S]*?font-size:\s*16px/.test(cssMob));
assert('offline Coba lagi file JS + reload', /offline-retry\.js/.test(offHtml) && /location\.reload/.test(offJs) && !/<script>(?!\\s*src)/.test(offHtml));
assert('SW cache /offline bukan .html', /sigaji-offline-v3/.test(sw) && /caches\.match\(SIGAJI_OFFLINE_PAGE\)/.test(sw) && /new Response\(r\.body/.test(sw));
assert('SW cache offline-retry', /offline-retry\.js/.test(sw));
assert('status bar default bukan translucent', /apple-mobile-web-app-status-bar-style" content="default"/.test(tpl) && !/black-translucent/.test(tpl));
assert('topbar padding-top safe-area', /padding-top:\s*max\(0\.4rem,\s*env\(safe-area-inset-top/.test(cssMob));
assert('Keluar tidak disembunyikan nav HP', !/bottom-nav-on \.topbar-logout/.test(cssMob.replace(/\s+/g, ' ')));
assert('Batal share tidak unduh', /AbortError/.test(save));
assert('riwayat tutup lapisan terakhir', /mbds\.length - 1/.test(hist) && /sigajiHistBackIf/.test(hist));
assert('ganti kartu replaceState', /sigajiHistReplace/.test(hist));
assert('GPS admin sekali per sesi', /sigaji_gps_hint_admin/.test(fs.readFileSync(path.join(ROOT, 'js/modules/app-mobile.js'), 'utf8')));
assert('GPS teks bukan hanya iPhone', !/iPhone\/iOS/.test(fs.readFileSync(path.join(ROOT, 'js/modules/app-mobile.js'), 'utf8')) && !/iOS sering/.test(fs.readFileSync(path.join(ROOT, 'mobile/app.js'), 'utf8')));
assert('latar html biru tua', /html,body\{background:#0c1929/.test(tpl));
assert('sw.js tidak di-cache lama', /\/sw\.js/.test(headers) && /no-store/.test(headers));

['sigaji-180.png', 'sigaji-192.png', 'sigaji-512.png', 'sigaji-maskable-192.png', 'sigaji-maskable-512.png'].forEach(function (name) {
  const p = path.join(ROOT, 'icons', 'pwa', name);
  const dim = pngSize(p);
  const want = name.indexOf('180') >= 0 ? 180 : name.indexOf('192') >= 0 ? 192 : 512;
  assert('ikon ' + name, dim.w === want && dim.h === want);
});

console.log('pwa-install.test.mjs: all passed');
