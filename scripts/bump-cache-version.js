/**
 * Samakan SEMUA ?v= di index.template.html (css + js, kecuali vendor/supabase)
 * + SIGAJI_BUILD (app-api-shim.js) + SIGAJI_MODULES_CACHE (constants.js).
 *
 * Usage: node scripts/bump-cache-version.js 11.5.16
 * Lalu: npm run assemble
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const ver = process.argv[2];
if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) {
  console.error('Usage: node scripts/bump-cache-version.js X.Y.Z');
  process.exit(1);
}

const templatePath = path.join(root, 'index.template.html');
const shimPath = path.join(root, 'js', 'modules', 'app-api-shim.js');
const constantsPath = path.join(root, 'js', 'constants.js');
const mobileHtmlPath = path.join(root, 'mobile', 'index.html');

/** /css/* dan /js/* kecuali /js/vendor/ */
const ASSET_VER_RE =
  /((?:href|src)="\/(?:css|js)\/(?!vendor\/)[^"]+\?v=)[^"]+/g;

let html = fs.readFileSync(templatePath, 'utf8');
const before = (html.match(/\?v=\d+\.\d+\.\d+/g) || []).filter(function (m) {
  return html.indexOf('vendor/supabase') < 0 || true;
});
html = html.replace(ASSET_VER_RE, '$1' + ver);
fs.writeFileSync(templatePath, html, 'utf8');

if (fs.existsSync(mobileHtmlPath)) {
  let mob = fs.readFileSync(mobileHtmlPath, 'utf8');
  mob = mob.replace(/(src="\/mobile\/[^"]+\?v=)[^"]+/g, '$1' + ver);
  fs.writeFileSync(mobileHtmlPath, mob, 'utf8');
}

let shim = fs.readFileSync(shimPath, 'utf8');
shim = shim.replace(
  /window\.SIGAJI_BUILD\s*=\s*'[^']+'/,
  "window.SIGAJI_BUILD = '" + ver + "'"
);
fs.writeFileSync(shimPath, shim, 'utf8');

let constants = fs.readFileSync(constantsPath, 'utf8');
constants = constants.replace(
  /const SIGAJI_MODULES_CACHE='[^']+'/,
  "const SIGAJI_MODULES_CACHE='" + ver + "'"
);
fs.writeFileSync(constantsPath, constants, 'utf8');

try {
  execSync('node scripts/assemble-index.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('assemble-index gagal — jalankan manual: npm run assemble');
  process.exit(1);
}

const afterHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vers = {};
(afterHtml.match(/\?v=([^"'&\s]+)/g) || []).forEach(function (m) {
  var v = m.replace('?v=', '');
  if (afterHtml.includes('vendor/supabase') && v.indexOf('.') > 0 && v.split('.').length === 3) {
    /* skip counting supabase lib version separately */
  }
  vers[v] = (vers[v] || 0) + 1;
});
var keys = Object.keys(vers).filter(function (k) {
  return k !== '2.105.4';
});
var ok = keys.length <= 1 && (keys.length === 0 || keys[0] === ver);

console.log('bump-cache-version: deploy cache → ' + ver);
console.log('  - index.template.html (semua /css/* & /js/* kecuali vendor)');
console.log('  - mobile/index.html (jika ada)');
console.log('  - js/modules/app-api-shim.js (SIGAJI_BUILD)');
console.log('  - js/constants.js (SIGAJI_MODULES_CACHE)');
console.log('  - index.html (assemble)');
if (!ok) {
  console.warn('PERINGATAN: versi ?v= di index.html masih campur:', vers);
  process.exit(1);
}
console.log('OK — semua asset ?v= = ' + ver + ' (kecuali supabase vendor)');
