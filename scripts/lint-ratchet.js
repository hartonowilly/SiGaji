/**
 * Ratchet lint — CI gagal jika warning/error bertambah vs baseline.
 *   node scripts/lint-ratchet.js          # cek (exit 1 jika regresi)
 *   node scripts/lint-ratchet.js --update # turunkan baseline setelah perbaikan
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const baselinePath = path.join(__dirname, 'lint-baseline.json');
const update = process.argv.includes('--update');

function runLint() {
  const out = execSync('npx eslint js/**/*.js tests/**/*.mjs -f json', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function summarize(report) {
  const byRule = {};
  const byFile = {};
  let errors = 0;
  let warnings = 0;
  report.forEach(function (f) {
    const rel = path.relative(root, f.filePath).replace(/\\/g, '/');
    f.messages.forEach(function (m) {
      if (m.severity === 2) errors++;
      else warnings++;
      byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1;
      byFile[rel] = (byFile[rel] || 0) + 1;
    });
  });
  return { errors, warnings, total: errors + warnings, byRule, byFile };
}

const report = runLint();
const sum = summarize(report);

if (update || !fs.existsSync(baselinePath)) {
  const payload = {
    updatedAt: new Date().toISOString(),
    errors: sum.errors,
    warnings: sum.warnings,
    total: sum.total,
    byRule: sum.byRule,
    byFile: sum.byFile,
  };
  fs.writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(
    'lint-ratchet: baseline ' +
      (update ? 'diperbarui' : 'dibuat') +
      ' — ' +
      sum.errors +
      ' error, ' +
      sum.warnings +
      ' warning'
  );
  process.exit(sum.errors > 0 ? 1 : 0);
}

const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const regressions = [];

if (sum.errors > base.errors) regressions.push('error ' + base.errors + ' → ' + sum.errors);
if (sum.warnings > base.warnings) regressions.push('warning ' + base.warnings + ' → ' + sum.warnings);

Object.keys(sum.byRule).forEach(function (rule) {
  const cur = sum.byRule[rule] || 0;
  const was = (base.byRule && base.byRule[rule]) || 0;
  if (cur > was) regressions.push(rule + ' ' + was + ' → ' + cur);
});

const payrollFiles = [
  'js/modules/app-core.js',
  'js/modules/app-hr-tunjvar.js',
  'js/pesangon.js',
];
payrollFiles.forEach(function (rel) {
  const cur = sum.byFile[rel] || 0;
  const was = (base.byFile && base.byFile[rel]) || 0;
  if (cur > was) regressions.push('payroll ' + rel + ' ' + was + ' → ' + cur);
});

if (regressions.length) {
  console.error('lint-ratchet: REGRESI — warning/error bertambah:');
  regressions.forEach(function (r) {
    console.error('  - ' + r);
  });
  console.error(
    '\nSaat ini: ' + sum.errors + ' error, ' + sum.warnings + ' warning (baseline ' + base.warnings + ')'
  );
  console.error('Perbaiki lalu: node scripts/lint-ratchet.js --update');
  process.exit(1);
}

console.log(
  'lint-ratchet: OK — ' +
    sum.errors +
    ' error, ' +
    sum.warnings +
    ' warning (baseline ' +
    base.warnings +
    ', turun ' +
    (base.warnings - sum.warnings) +
    ')'
);
process.exit(sum.errors > 0 ? 1 : 0);
