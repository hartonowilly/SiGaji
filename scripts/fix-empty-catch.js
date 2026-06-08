/**
 * Isi catch {} kosong dengan sigajiCatchWarn (sekali jalan / setelah audit).
 * Jalankan: node scripts/fix-empty-catch.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      if (name === 'vendor' || name === 'node_modules') return;
      walk(fp, out);
    } else if (name.endsWith('.js')) out.push(fp);
  });
}

const files = [];
walk(path.join(root, 'js'), files);

/** catch(x){} atau catch(x){ hanya komentar } */
const EMPTY_CATCH =
  /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*(?:\/\*[\s\S]*?\*\/)?\s*\}/g;

let total = 0;

files.forEach(function (fp) {
  let src = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(root, fp);
  let n = 0;
  const next = src.replace(EMPTY_CATCH, function (_m, varName) {
    n++;
    return 'catch(' + varName + '){sigajiCatchWarn("' + rel.replace(/\\/g, '/') + '",' + varName + ');}';
  });
  if (n) {
    fs.writeFileSync(fp, next, 'utf8');
    total += n;
    console.log(rel + ': ' + n);
  }
});

console.log('\nTotal catch diisi: ' + total);
