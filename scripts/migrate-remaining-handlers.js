/**
 * Sisa onchange/oninput/onclick/onkeydown di template, partials, mobile
 * → data-sigaji-action. Jalankan: node scripts/migrate-remaining-handlers.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function attrInvoke(fn) {
  return 'data-sigaji-action="invoke" data-fn="' + fn + '"';
}
function attrValue(fn, extra) {
  return 'data-sigaji-action="call-value" data-fn="' + fn + '"' + (extra ? ' ' + extra : '');
}

const REPLACEMENTS = [
  ['onchange="importTunjVarExcel(this)"', attrValue('importTunjVarExcel', 'data-arg="$this"')],
  ['onchange="sigajiSimSet(\'gapokPct\',parseFloat(this.value)||0)"', attrValue('sigajiSimSet', 'data-arg="$float" data-key="gapokPct"')],
  ['onchange="sigajiSimSet(\'tunjPct\',parseFloat(this.value)||0)"', attrValue('sigajiSimSet', 'data-arg="$float" data-key="tunjPct"')],
  ['onchange="sigajiSimSet(\'dept\',this.value)"', attrValue('sigajiSimSet', 'data-key="dept"')],
  ['onchange="sigajiSimSet(\'nik\',this.value)"', attrValue('sigajiSimSet', 'data-key="nik"')],
  ['onchange="sigajiSimThrSet(\'gapokPct\',parseFloat(this.value)||0)"', attrValue('sigajiSimThrSet', 'data-arg="$float" data-key="gapokPct"')],
  ['onchange="sigajiSimThrSet(\'tunjPct\',parseFloat(this.value)||0)"', attrValue('sigajiSimThrSet', 'data-arg="$float" data-key="tunjPct"')],
  ['onchange="sigajiSimThrSet(\'mkBulan\',this.value)"', attrValue('sigajiSimThrSet', 'data-key="mkBulan"')],
  ['onchange="sigajiSimThrSet(\'dept\',this.value)"', attrValue('sigajiSimThrSet', 'data-key="dept"')],
  ['onchange="sigajiSimThrSet(\'nik\',this.value)"', attrValue('sigajiSimThrSet', 'data-key="nik"')],
  ['onchange="sigajiSimPsgSet(\'nik\',this.value)"', attrValue('sigajiSimPsgSet', 'data-key="nik"')],
  ['onchange="sigajiSimPsgSet(\'tglBerhenti\',this.value)"', attrValue('sigajiSimPsgSet', 'data-key="tglBerhenti"')],
  ['onchange="sigajiSimPsgSet(\'alasan\',this.value)"', attrValue('sigajiSimPsgSet', 'data-key="alasan"')],
  ['onchange="sigajiSimPsgSet(\'sisaCuti\',this.value)"', attrValue('sigajiSimPsgSet', 'data-key="sisaCuti"')],
  ['onchange="sigajiSimPsgSet(\'uphTambahan\',this.value)"', attrValue('sigajiSimPsgSet', 'data-key="uphTambahan"')],
  ['onchange="sigajiSimPsgSet(\'pisah\',this.value)"', attrValue('sigajiSimPsgSet', 'data-key="pisah"')],
  ['onchange="onSlipPeriodeChange()"', attrInvoke('onSlipPeriodeChange')],
  ['onchange="previewSlip()"', attrInvoke('previewSlip')],
  ['onchange="uploadLogo(this)"', attrValue('uploadLogo', 'data-arg="$this"')],
  ['oninput="typeof onPrsBrandColorInput===\'function\'&&onPrsBrandColorInput()"', attrInvoke('onPrsBrandColorInput') + ' data-sigaji-live="1"'],
  ['onchange="renderUmkPanel()"', attrInvoke('renderUmkPanel')],
  ['oninput="onPeriodeNamaInput()"', attrInvoke('onPeriodeNamaInput') + ' data-sigaji-live="1"'],
  ['onchange="updatePolaPeriode()"', attrInvoke('updatePolaPeriode')],
  ['onchange="toggleOpsiLebihBayar()"', attrInvoke('toggleOpsiLebihBayar')],
  ['onchange="toggleThrFields()"', attrInvoke('toggleThrFields')],
  ['onchange="onKoreksiAbsensiOtomatisChange()"', attrInvoke('onKoreksiAbsensiOtomatisChange')],
  ['onchange="simpanMasterCuti()"', attrInvoke('simpanMasterCuti')],
  ['onchange="renderMigrasiPphSaldo()"', attrInvoke('renderMigrasiPphSaldo')],
  ['onchange="importMigrasiPphExcel(this)"', attrValue('importMigrasiPphExcel', 'data-arg="$this"')],
  ['onchange="loadMySlip()"', attrInvoke('loadMySlip')],
  ['onchange="readImportFile(this)"', attrValue('readImportFile', 'data-arg="$this"')],
  ['onchange="renderAuditLog()"', attrInvoke('renderAuditLog')],
  ['oninput="renderAuditLog()"', attrInvoke('renderAuditLog') + ' data-sigaji-live="1"'],
  ['onchange="onSpTipeKerjaChange()"', attrInvoke('onSpTipeKerjaChange')],
  ['onchange="onSpSiklusGajiChange()"', attrInvoke('onSpSiklusGajiChange')],
  ['oninput="onNamaChange()"', attrInvoke('onNamaChange') + ' data-sigaji-live="1"'],
  ['onchange="onJkChange()"', attrInvoke('onJkChange')],
  ['oninput="sigajiRefreshSpTaxIdHint&&sigajiRefreshSpTaxIdHint()"', attrInvoke('sigajiRefreshSpTaxIdHint') + ' data-sigaji-live="1"'],
  ['oninput="formatNPWP(this);sigajiRefreshSpTaxIdHint&&sigajiRefreshSpTaxIdHint()"', attrValue('onSpNpwpInput', 'data-arg="$this"') + ' data-sigaji-live="1"'],
  ['onchange="toggleSpPhkWrap()" oninput="toggleSpPhkWrap()"', attrInvoke('toggleSpPhkWrap') + ' data-sigaji-live="1"'],
  ['onchange="updatePTKPVal()"', attrInvoke('updatePTKPVal')],
  ['oninput="onReknamEdit()"', attrInvoke('onReknamEdit') + ' data-sigaji-live="1"'],
  ['onclick="switchPayrollSpTab(this,\'sp-gaji\')"', ''],
  ['onclick="switchPayrollSpTab(this,\'sp-bpjs\')"', ''],
  ['onclick="switchPayrollSpTab(this,\'sp-natura\')"', ''],
  ['onclick="switchPayrollSpTab(this,\'sp-pphret\')"', ''],
  ['onclick="switchPayrollSpTab(this,\'sp-ring\')"', ''],
  ['oninput="updateGajiSummary()"', attrInvoke('updateGajiSummary') + ' data-sigaji-live="1"'],
  ['oninput="onPPhRetChange()"', attrInvoke('onPPhRetChange') + ' data-sigaji-live="1"'],
  ['onkeydown="if(event.key===\'Enter\')doUpdatePassword()"', 'data-sigaji-enter="doUpdatePassword"'],
  ['onkeydown="if(event.key===\'Enter\')submitForgotPassword()"', 'data-sigaji-enter="submitForgotPassword"'],
  ['onchange="sigajiMutasiOnCabangChange()"', attrInvoke('sigajiMutasiOnCabangChange')],
  ['oninput="sigajiRefreshMutasiPreview()" onchange="sigajiRefreshMutasiPreview()"', attrInvoke('sigajiRefreshMutasiPreview') + ' data-sigaji-live="1"'],
  ['oninput="updateResetButtonState()"', attrInvoke('updateResetButtonState') + ' data-sigaji-live="1"'],
  ['oninput="mobLocUpdateRadiusUi()"', attrInvoke('mobLocUpdateRadiusUi') + ' data-sigaji-live="1"'],
  ['onchange="renderAbsensi();renderCutiRekap();"', attrInvoke('renderAbsensiDanCuti')],
  ['onchange="renderMobileLateReport()"', attrInvoke('renderMobileLateReport')],
  ['onclick="sigajiMobileLogin()"', attrInvoke('sigajiMobileLogin')],
  ['onclick="sigajiMobileGo(\'screen-notif\')"', attrInvoke('sigajiMobileGo') + ' data-arg="screen-notif"'],
  ['onclick="sigajiMobileGo(\'screen-leave\')"', attrInvoke('sigajiMobileGo') + ' data-arg="screen-leave"'],
  ['onclick="sigajiMobileGo(\'screen-home\')"', attrInvoke('sigajiMobileGo') + ' data-arg="screen-home"'],
  ['onclick="sigajiMobileLogout()"', attrInvoke('sigajiMobileLogout')],
  ['onclick="sigajiMobileSubmitIn()"', attrInvoke('sigajiMobileSubmitIn')],
  ['onclick="sigajiMobileSubmitOut()"', attrInvoke('sigajiMobileSubmitOut')],
  ['onclick="sigajiMobileMarkAllNotifRead()"', attrInvoke('sigajiMobileMarkAllNotifRead')],
  ['onclick="sigajiMobileSubmitLeave()"', attrInvoke('sigajiMobileSubmitLeave')],
];

const FILES = [
  'index.template.html',
  'partials/pg-absensi.html',
  'mobile/index.html',
];

let total = 0;
FILES.forEach(function (rel) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, 'utf8');
  let n = 0;
  REPLACEMENTS.forEach(function (pair) {
    const from = pair[0];
    const to = pair[1];
    if (!from) return;
    const count = html.split(from).length - 1;
    if (count) {
      html = html.split(from).join(to);
      n += count;
    }
  });
  html = html.replace(
    /\s*<script>if\(typeof sigajiApplyCloudLoginUi==='function'\)sigajiApplyCloudLoginUi\(\);<\/script>\s*/g,
    '\n'
  );
  html = html.replace(
    / class="rounded-sm font-12 select-inline" id="audit-periode" style="padding:6px 10px; border:1\.5px solid #dde1e9; font-family:inherit; outline:none"/g,
    ' class="rounded-sm font-12 select-inline audit-select" id="audit-periode"'
  );
  html = html.replace(
    / class="rounded-sm w-full font-13" type="password" id="reset-pw"/g,
    ' class="rounded-sm w-full font-13 reset-danger-inp" type="password" id="reset-pw"'
  );
  html = html.replace(
    / class="rounded-sm w-full font-13" id="reset-inp"/g,
    ' class="rounded-sm w-full font-13 reset-danger-inp" id="reset-inp"'
  );
  html = html.replace(/ style="border:2px solid #f5a3a3; padding:9px 12px; font-family:inherit; outline:none"/g, '');
  html = html.replace(
    / class="modal modal-sm" style="border-top:4px solid #9b2121"/g,
    ' class="modal modal-sm modal-danger-top"'
  );
  fs.writeFileSync(file, html);
  console.log(rel + ':', n, 'handler');
  total += n;
});
console.log('total', total);
