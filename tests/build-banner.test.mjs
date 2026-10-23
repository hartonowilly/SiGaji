/**
 * Pembaca versi deploy dari isi app-api-shim.js.
 * Jalankan: node tests/build-banner.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

const el = { classList: { toggle: function () {} }, style: { setProperty: function () {} }, clientHeight: 800, clientWidth: 1200 };
const ctx = {
  window: {
    matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
    addEventListener: function () {},
    innerHeight: 800,
    innerWidth: 1200,
  },
  document: {
    readyState: 'complete',
    visibilityState: 'hidden',
    documentElement: el,
    body: { appendChild: function () {} },
    addEventListener: function () {},
    getElementById: function () { return null; },
  },
  setInterval: function () {},
  fetch: function () { return Promise.resolve({ ok: false, text: function () { return Promise.resolve(''); } }); },
};
ctx.window.window = ctx.window;
ctx.sigajiCatchWarn = function () {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modules/app-api-shim.js'), 'utf8'), ctx);

assertEq('versi di file shim', ctx.sigajiParseBuildTag("window.SIGAJI_BUILD = '11.6.7';"), '11.6.7');
assertEq('bukan assignment lain', ctx.sigajiParseBuildTag("var x = '11.6.7';"), '');
assertEq('kosong', ctx.sigajiParseBuildTag(''), '');

var src = fs.readFileSync(path.join(ROOT, 'js/modules/app-api-shim.js'), 'utf8');
assertEq('shim memuat SIGAJI_BUILD yang terbaca', ctx.sigajiParseBuildTag(src), ctx.window.SIGAJI_BUILD);

console.log('Banner versi: semua tes lulus.');
