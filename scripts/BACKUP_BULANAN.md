# Checklist backup bulanan — SiGaji + Supabase

## Pahami dulu: 3 cara berbeda

| Cara | Dari mana? | Hasil di laptop | Isi |
|------|------------|-----------------|-----|
| **A. pg_dump** (skrip `backup-supabase-pgdump.cmd`) | **CMD Windows** (bukan klik di web SiGaji) | Satu file `.dump` | **Seluruh database** PostgreSQL (semua tabel `sigaji_*` + Auth metadata tidak ikut) |
| **B. Export CSV per tabel** | **Supabase.com** → Table Editor | Banyak file `.csv` | **Satu tabel** per file (karyawan saja, periode saja, …) |
| **C. Backup JSON** | **SiGaji** → menu Backup | Satu file `.json` | Snapshot aplikasi (blob besar, untuk restore di SiGaji) |

**“Backup proper database”** yang Anda maksud biasanya = **A (pg_dump)** atau backup otomatis **Supabase Pro**.

Bukan backup lewat halaman login SiGaji, dan bukan otomatis “per tabel” kecuali Anda pilih cara **B** manual tiap tabel.

---

## Setup sekali (Windows + pg_dump)

1. Install **PostgreSQL** (Windows) → centang **Command Line Tools** → `pg_dump` masuk PATH.
2. Di Supabase: **Project Settings → Database**
   - Catat **password** database
   - Ambil connection string **Direct** (`db.xxxxx.supabase.co:5432`), **bukan** pooler Session
3. Salin `scripts/backup-supabase.example.env` → `scripts/backup-supabase.env`
4. Isi `SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres`
5. Jangan commit `backup-supabase.env` ke GitHub.

---

## Checklist bulanan (disarankan)

### Minggu / sebelum tutup periode gaji

- [ ] Login SiGaji, cek data periode aktif benar
- [ ] Di Supabase Table Editor: `sigaji_karyawan` jumlah baris masuk akal
- [ ] Opsional: export CSV `sigaji_karyawan` + `sigaji_periode` (arsip ringan)

### Bulanan — backup database proper

- [ ] Jalankan `scripts\backup-supabase-pgdump.cmd`
- [ ] Pastikan file `.dump` tersimpan di folder `backups\` (atau folder di `BACKUP_DIR`)
- [ ] Copy file `.dump` ke **Google Drive / HDD eksternal** (bukan hanya di PC kantor)
- [ ] Catat tanggal + ukuran file di catatan internal

### Triwulanan / sebelum perubahan besar

- [ ] Download Backup JSON dari SiGaji (recovery cepat lewat aplikasi)
- [ ] Tes restore: buka file backup lama di lingkungan uji (bukan production) jika perlu

### Keamanan

- [ ] `backup-supabase.env` tidak ikut push Git
- [ ] File `.dump` berisi data gaji — simpan terenkripsi / folder pribadi

---

## Restore dari file `.dump` (hanya jika paham risiko)

Restore **menimpa** data di Supabase. Lakukan di project **uji** dulu, atau dengan bantuan admin.

```text
pg_restore -d "postgresql://postgres:...@db.xxx.supabase.co:5432/postgres" --clean --if-exists backups\sigaji_supabase_YYYY-MM-DD_HHMM.dump
```

---

## Supabase Free vs Pro

| | Free | Pro |
|--|------|-----|
| Backup otomatis harian di dashboard | Terbatas / tidak seperti Pro | Ya |
| pg_dump manual (skrip ini) | **Bisa** | **Bisa** |
| Export CSV per tabel di web | **Bisa** | **Bisa** |

---

## Ringkas jawaban pertanyaan Anda

- **“Backup proper database per tabel?”**  
  - **pg_dump** = biasanya **satu file** berisi **semua tabel** sekaligus (bukan satu file per tabel).  
  - **Per tabel** = export **CSV** manual di website Supabase, tiap tabel unduh sendiri.

- **“Backup di web lalu dapat file di laptop?”**  
  - **SiGaji web** → hanya JSON (menu Backup).  
  - **Supabase web** → CSV per tabel (Table Editor).  
  - **pg_dump** → jalankan **skrip di laptop** (CMD), file `.dump` langsung tersimpan di laptop.

Skrip: `scripts/backup-supabase-pgdump.cmd`

---

## Backup dari web SiGaji (online)

Menu **Backup & Import** → tombol **Unduh backup database (cloud)** (Admin/HRD, Supabase + Netlify Functions).

- Unduh file JSON terstruktur **per tabel** (`tables.sigaji_karyawan`, …), bukan satu blob aplikasi.
- Bukan file `.dump` pg_dump; restore tidak otomatis seperti pg_restore.
- Centang **tanpa logo** agar file lebih kecil.
- Di Netlify wajib env: `SIGAJI_SUPABASE_SERVICE_ROLE_KEY` (sama seperti fungsi Telegram/registrasi).
