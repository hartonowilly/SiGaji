import js from '@eslint/js';
import globals from 'globals';

/** Global browser SiGaji (onclick, storage, payroll). */
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
};

export default [
  {
    ignores: ['js/vendor/**', '_archive/**', 'node_modules/**', 'sigaji_mobile/**'],
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...sigajiGlobals },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-redeclare': 'warn',
    },
  },
  {
    files: ['js/modules/app-core.js'],
    rules: {
      'no-undef': 'off',
      'no-global-assign': 'off',
      'no-redeclare': 'off',
      'no-empty': 'off',
    },
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
