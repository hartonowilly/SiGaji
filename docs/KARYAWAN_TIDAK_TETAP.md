# Pegawai tetap vs tidak tetap (NIK terpisah)

## ID karyawan di SiGaji

| Tipe | Field `tipe_kerja` | Prefiks NIK | Contoh |
|------|-------------------|-------------|--------|
| Pegawai tetap | `tetap` | **K** | K0001, K0042 |
| Pegawai tidak tetap | `tidak_tetap` | **NT** | NT0001, NT0010 |

- Urutan angka **tidak dicampur**: NT0001 bukan lanjutan dari K0099.
- NIK lama **K…** tetap dianggap pegawai tetap (migrasi otomatis saat buka data).
- Validasi saat simpan profil: NIK harus cocok dengan tipe pegawai.

## Menambah karyawan

**Master Karyawan:**

- **+ Pegawai Tetap** → NIK otomatis `Kxxxx`, BPJS default aktif, gaji pokok default.
- **+ Pegawai Tidak Tetap** → NIK otomatis `NTxxxx`, BPJS default nonaktif, honor lewat tunjangan **Tidak Tetap**.

Filter tabel: **Semua tipe** / **Pegawai tetap (K…)** / **Tidak tetap (NT…)**.

## Pajak & komponen (satu tenant)

- Tetap dan tidak tetap tetap di **satu `tenant_key`** (satu perusahaan).
- PPh 21 bulanan (TER) dipakai untuk keduanya jika masuk penghasilan pegawai — sesuaikan komponen:
  - Tidak tetap: tunjangan tipe **Tidak Tetap** / variabel per periode.
  - Tetap: tunjangan **Tetap**, THR, BPJS.
- Honor / bukan pegawai dengan aturan potongan berbeda → konsultasikan akuntan; aplikasi belum memisahkan mesin PPh non-pegawai.

## Multi-tenant

Tidak mengubah `tenant_key`. Lihat [MULTI_TENANT_HOSTED.md](MULTI_TENANT_HOSTED.md).

## File teknis

- `js/karyawan-tipe.js` — prefiks, validasi, skeleton baru
- `js/modules/app-hr.js` — UI & simpan profil
- `js/storage.js` — migrasi schema 14 → `tipe_kerja`
