# Modul SiGaji (`js/modules/`)

`app.js` monolit dipindah ke modul per domain. Arsip monolit: `_archive/app.legacy.js`.

HTML: `index.template.html` + `partials/` → rakit dengan `npm run assemble`.
Boot inline (dulu di index): `app-api-shim.js`, `app-boot-resume.js`, `app-boot.js`.

## Urutan muat (wajib di `index.html`)

1. `app-globals.js` — placeholder (global UI: `cpNik`, `bmState`, `CU` di `storage.js` saja)
2. `app-core.js` — helper, snapshot, `hitungGaji`, BPJS, THR calc
3. `app-access.js` — hak akses, user, branding, login
4. `app-hr.js` — dashboard, karyawan, komponen gaji, proses gaji
5. `app-slip.js` — slip, kirim Telegram/email, PDF
6. `app-reports.js` — PPh 21, laporan, THR
7. `app-absensi.js` — absensi, cuti, lembur, hari libur
8. `app-master.js` — periode, master (UMK), backup/import
9. `app-migrasi-pph.js` — saldo migrasi PPh YTD + import Excel onboarding
10. `app-shell.js` — navigasi, `showPg`, init, TER, lisensi UI

Sebelum modul: `constants.js`, `storage.js`, `ptkp.js`  
Sesudah modul: `pesangon.js`, `config.js`, `cloud-*.js`

## Regenerate split

```bash
node scripts/split-app.js
```

(Menimpa modul dari `app.legacy.js` atau `app.js` monolit jika masih ada.)
