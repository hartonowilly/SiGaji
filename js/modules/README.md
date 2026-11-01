# Modul SiGaji (`js/modules/`)

`app.js` monolit dipindah ke modul per domain. Arsip lama ada di riwayat git (folder `_archive` tidak ikut rilis).

HTML: `index.template.html` + `partials/` → rakit dengan `npm run assemble`.
Boot inline (dulu di index): `app-api-shim.js`, `app-boot-resume.js`, `app-boot.js`.

## Urutan muat (wajib di `index.html`)

1. `app-globals.js` — placeholder (global UI: `cpNik`, `bmState`, `CU` di `storage.js` saja)
2. `app-core.js` — helper, snapshot, `hitungGaji`, BPJS, THR calc
3. `app-access.js` — hak akses, user, matriks izin
4. `app-auth.js` — branding, login, idle, unggah logo
5. `app-sys.js` — status sistem, `renderAll`
6. `app-hr.js` — dashboard, master karyawan
7. `app-hr-komponen.js` — slide panel, tunjangan, BPJS, natura
8. `app-hr-payroll.js` — proses gaji, approval
9. `app-slip.js` — slip, kirim Telegram/email, PDF
10. `app-reports.js` — PPh 21, laporan, THR
11. `app-absensi.js` — absensi, cuti, lembur, hari libur
12. `app-master.js` — periode, master (UMK), backup/import
13. `app-migrasi-pph.js` — saldo migrasi PPh YTD + import Excel onboarding
14. `app-shell.js` — navigasi, `showPg`, init, TER, lisensi UI

Sebelum modul: `constants.js`, `storage.js`, `ptkp.js`  
Sesudah modul: `pesangon.js`, `config.js`, `cloud-*.js`

Pecah file besar (sekali, jangan diulang jika sudah terpecah): `node scripts/split-large-modules.js`
