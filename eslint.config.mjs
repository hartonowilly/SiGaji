import js from '@eslint/js';
import globals from 'globals';
import noUnsafeInnerhtml from './eslint-rules/no-unsafe-innerhtml.mjs';

/** Global browser SiGaji (script tags, tanpa bundler). */
const sigajiGlobals = {
  perusahaan: 'readonly',
  periodes: 'readonly',
  hariLibur: 'readonly',
  masterCuti: 'readonly',
  absensi: 'readonly',
  prorata: 'readonly',
  thrManual: 'readonly',
  lembur: 'readonly',
  karSnapshot: 'readonly',
  karyawan: 'readonly',
  tunjVarBulan: 'readonly',
  tunjVarLabels: 'readonly',
  approvals: 'readonly',
  notifikasi: 'readonly',
  TER_A: 'readonly',
  TER_B: 'readonly',
  TER_C: 'readonly',
  BPJS_DEF: 'readonly',
  DEFAULT_PTKP: 'readonly',
  PTKP_KEYS: 'readonly',
  MODULES: 'readonly',
  fmt: 'readonly',
  toast: 'readonly',
  saveAll: 'readonly',
  nilaiPTKP: 'readonly',
  getPTKPTable: 'readonly',
  document: 'readonly',
  window: 'readonly',
  console: 'readonly',
  escapeHtml: 'readonly',
  escapeAttr: 'readonly',
  escNik: 'readonly',
  sigajiFetchJson: 'readonly',
  sigajiApiToast: 'readonly',
  sigajiSetTbodyRows: 'readonly',
  sigajiDataAction: 'readonly',
};

const sigajiPlugin = {
  rules: {
    'no-unsafe-innerhtml': noUnsafeInnerhtml,
  },
};

/** Aturan umum modul legacy (banyak global dari script tag). */
const legacyJsRules = {
  'no-undef': 'off',
  'no-global-assign': 'off',
  'no-redeclare': 'warn',
  'no-empty': 'warn',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  eqeqeq: ['warn', 'always', { null: 'ignore' }],
  'sigaji/no-unsafe-innerhtml': 'warn',
};

export default [
  {
    ignores: ['js/vendor/**', '_archive/**', 'node_modules/**', 'sigaji_mobile/**'],
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    plugins: { sigaji: sigajiPlugin },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...sigajiGlobals },
    },
    rules: legacyJsRules,
  },
  {
    files: ['tests/**/*.mjs', 'scripts/**/*.js', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
