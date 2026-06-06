/**
 * Samakan ?v= semua js/modules/* di index.template.html
 * + SIGAJI_BUILD (app-api-shim.js) + SIGAJI_MODULES_CACHE (constants.js).
 *
 * Usage: node scripts/bump-cache-version.js 11.5.9
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ver = process.argv[2];
if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) {
  console.error('Usage: node scripts/bump-cache-version.js X.Y.Z');
  process.exit(1);
}

const templatePath = path.join(root, 'index.template.html');
const shimPath = path.join(root, 'js', 'modules', 'app-api-shim.js');
const constantsPath = path.join(root, 'js', 'constants.js');

let html = fs.readFileSync(templatePath, 'utf8');
html = html.replace(
  /(src="\/js\/modules\/[^"]+\?v=)[^"]+/g,
  '$1' + ver
);
fs.writeFileSync(templatePath, html, 'utf8');

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

console.log('bump-cache-version: set deploy cache to ' + ver);
console.log('  - index.template.html (js/modules/*)');
console.log('  - js/modules/app-api-shim.js (SIGAJI_BUILD)');
console.log('  - js/constants.js (SIGAJI_MODULES_CACHE)');
console.log('Next: npm run assemble && git push');
