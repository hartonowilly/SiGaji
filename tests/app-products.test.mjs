import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, '../js/modules/app-products.js'), 'utf8');

const sandbox = {
  console,
  window: {},
  tenantLicense: { enabledModules: ['payroll'] },
  SIGAJI_PRODUCT_SKUS: [
    { id: 'payroll', lbl: 'Payroll' },
    { id: 'erp', lbl: 'ERP' },
    { id: 'pos_web', lbl: 'POS' },
  ],
  SIGAJI_MODULE_PRODUCT_SKU: { kasir: 'pos_web', dashboard: 'payroll' },
  sigajiCatchWarn: () => {},
  CU: { role: 'Admin' },
  toast: () => {},
  saveAll: () => {},
  renderSidebar: () => {},
  perusahaan: {},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const {
  sigajiNormalizeEnabledModules,
  sigajiIsProductSkuEnabled,
  sigajiIsModuleLicensed,
} = sandbox;

assert.equal(JSON.stringify(sigajiNormalizeEnabledModules(undefined)), '["payroll"]');
assert.equal(JSON.stringify(sigajiNormalizeEnabledModules(['erp', 'erp', 'bogus'])), '["erp"]');
assert.equal(sigajiIsProductSkuEnabled('payroll'), true);
assert.equal(sigajiIsProductSkuEnabled('erp'), false);

sandbox.tenantLicense.enabledModules = ['payroll', 'pos_web'];
assert.equal(sigajiIsProductSkuEnabled('pos_web'), true);
assert.equal(sigajiIsModuleLicensed('kasir'), true);

sandbox.tenantLicense.enabledModules = ['payroll'];
assert.equal(sigajiIsModuleLicensed('kasir'), false);

console.log('app-products.test.mjs OK');
