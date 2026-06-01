const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'js', 'modules');
const order = [
  'app-globals.js', 'app-core.js', 'app-access.js', 'app-hr.js', 'app-slip.js',
  'app-reports.js', 'app-absensi.js', 'app-master.js', 'app-shell.js',
];
let out = '/* Arsip monolit — digabung dari js/modules */\n';
for (const f of order) {
  let c = fs.readFileSync(path.join(root, f), 'utf8');
  if (f === 'app-globals.js') {
    out += c.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
    continue;
  }
  c = c.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
  out += c + '\n';
}
fs.writeFileSync(path.join(__dirname, '..', 'js', 'app.legacy.js'), out, 'utf8');
console.log('app.legacy.js', out.length, 'chars');
