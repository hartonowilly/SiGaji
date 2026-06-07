# Panduan Tes Payroll SiGaji

> **Aman:** tes ini **tidak** menyentuh Supabase, **tidak** menambah karyawan ke database, dan **tidak** mengubah slip yang sudah terbit. Semua data di tes adalah contoh fiktif di memori komputer.

---

## Kapan jalankan tes?

- **Sebelum deploy** ke hosting (Netlify, dll.)
- **Setelah mengubah** rumus di `js/modules/app-core.js`, `js/constants.js`, atau `js/ptkp.js`
- **Setelah update** tabel TER / PTKP / tarif BPJS

---

## Persiapan (sekali saja)

1. Pastikan **Node.js** terpasang (cek: buka terminal, ketik `node -v` — harus ada angka versi).
2. Buka folder project SiGaji di terminal:

   ```powershell
   cd "C:\Users\harto\Downloads\sigaji-app"
   ```

3. Untuk **tes payroll saja**: cukup Node.js (tanpa install).

4. Untuk **lint & typecheck** (opsional): sekali jalankan di folder project:

   ```powershell
   npm install
   ```

---

## Langkah menjalankan tes (setiap kali)

### Langkah 1 — Buka terminal

- Windows: PowerShell atau Command Prompt
- Atau terminal di Cursor / VS Code (`Terminal` → `New Terminal`)

### Langkah 2 — Pindah ke folder project

```powershell
cd "C:\Users\harto\Downloads\sigaji-app"
```

### Langkah 3 — Jalankan semua tes payroll

```powershell
npm test
```

Atau tanpa npm:

```powershell
node tests/run-payroll-tests.mjs
```

### Langkah 4 — Baca hasilnya

**Kalau lulus**, akhir output seperti ini:

```
OK: TK0 10jt TER 2%
...
Semua suite payroll lulus.
```

**Kalau gagal**, ada baris `FAIL:` + penjelasan angka yang salah:

```
FAIL: Budi PPh TER — dapat 120000, harus 125448
```

Artinya: rumus berubah atau ada bug — **jangan deploy** dulu sampai dicek.

### Langkah 5 — Jika gagal, apa yang dilakukan?

1. Baca baris `FAIL` — fungsi dan angka mana yang beda.
2. Putuskan:
   - **Bug** → perbaiki kode, jalankan `npm test` lagi.
   - **Perubahan sengaja** (rumus baru) → hitung ulang manual, update angka `expected` di file tes yang disebut, lalu `npm test` lagi.
3. Setelah semua lulus → baru deploy / terbitkan gaji.

### Langkah 6 — (Opsional) Lint & cek tipe payroll

Setelah `npm install`:

```powershell
npm run check:payroll
```

Atau satu per satu:

```powershell
npm test
npm run lint:payroll
npm run typecheck:payroll
```

- **npm test** — angka payroll harus cocok (paling penting)
- **lint** — peringatan kode (`==`, variabel tidak dipakai)
- **typecheck** — konstanta TER/PTKP/BPJS (`constants.js`, `ptkp.js`)
- **JSDoc** — kontrak fungsi `hitungGaji`, `hitungPPhBln`, dll. di `app-core.js`

---

## Tes terpisah (opsional)

| Perintah | Isi |
|---|---|
| `npm test` | Semua tes payroll (disarankan) |
| `npm run test:all` | Payroll + tes cuti |
| `npm run test:cuti` | Tes logika cuti saja |
| `npm run lint` | ESLint file payroll + tes |
| `npm run typecheck:payroll` | Cek tipe JSDoc app-core |
| `node tests/payroll-slip-fixture.test.mjs` | Fixture slip emas (JSON) |

---

## Apa yang dites? (ringkas)

| File | Lapisan | Contoh |
|---|---|---|
| `payroll-pure.test.mjs` | A | PPh TER, BPJS, pesangon final |
| `payroll-scenario.test.mjs` | B | Gaji bulanan & prorata |
| `payroll-scenario-advanced.test.mjs` | C | THR & Desember |
| `payroll-scenario-resign.test.mjs` | D | Resign tengah tahun + rekonsiliasi |
| `payroll-slip-fixture.test.mjs` | E | Slip emas dari `fixtures/slip-emas.json` |

Karyawan di tes (`TES-*`, `FIX-*`) — **hanya di file**, tidak ada di database Anda.

---

## Menambah slip nyata ke fixture

1. Buka `tests/fixtures/slip-emas.json`.
2. Duplikat blok `cases[]` atau edit angka `expected`.
3. Isi `karyawan` (gapok, PTKP, tunjangan) — **nama/NIK fiktif** boleh.
4. Isi `expected` dari slip yang sudah Anda percaya.
5. Tulis di `sumber`: *"Slip Maret 2026 PT X, dicek tanggal …"*
6. Jalankan `npm test`.

---

## File penting

```
tests/
  PANDUAN-TES-PAYROLL.md
  run-payroll-tests.mjs
  fixtures/slip-emas.json    ← salin angka slip nyata di sini
  lib/payroll-harness.mjs
  payroll-pure.test.mjs
  payroll-scenario.test.mjs
  payroll-scenario-advanced.test.mjs
  payroll-scenario-resign.test.mjs
  payroll-slip-fixture.test.mjs
  cuti-tracking.test.mjs
js/types/
  payroll-globals.d.ts         ← tipe untuk @ts-check
  tsconfig.payroll.json
eslint.config.mjs
```

---

## FAQ

**Apakah tes ini mengubah data karyawan saya?**  
Tidak. Tes hanya jalan di memori Node.js di komputer Anda.

**Harus online / login Supabase?**  
Tidak.

**Berapa lama?**  
Biasanya beberapa detik.

**Siapa yang boleh menjalankan?**  
Siapa saja yang punya copy folder project + Node.js (developer, Anda sendiri, konsultan).
