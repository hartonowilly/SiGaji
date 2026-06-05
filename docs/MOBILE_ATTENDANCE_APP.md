# App Android SiGaji — Absensi (foto + GPS) & pengajuan cuti

Dokumen spesifikasi yang sudah disepakati. Skema SQL: [`sql/supabase_sigaji_mobile_attendance.sql`](../sql/supabase_sigaji_mobile_attendance.sql).

---

## Keputusan produk (fixed)

| # | Keputusan |
|---|-----------|
| 1 | **HRD** mengelola lokasi kerja & penugasan luar kota (bukan hanya Admin) |
| 2 | **Sabtu ikut hari kerja** jika ada penugasan / pola kerja 6 hari |
| 3 | **Sakit**: surat dokter **wajib dari hari pertama** (tidak bisa submit tanpa lampiran) |
| 4 | **Check-out wajib** setiap hari kerja (pasangan dengan check-in) |
| 5 | Satu app Android, login **email + password Supabase** (sama dengan SiGaji cloud) |

---

## Arsitektur

```
App Android (Kotlin/Flutter)
    → Supabase Auth (JWT)
    → POST /api/attendance-checkin|checkout  (validasi geofence + anti-mock)
    → POST /api/leave-request (+ upload Storage)
SiGaji Web
    → HRD: Master lokasi + penugasan + approve cuti
    → Setuju cuti → isi absensi[nik][tanggal] di payload gaji
```

Tabel terpisah dari blob JSON (foto besar di **Storage**, bukan `sigaji_cloud`).

---

## 1. Banyak titik GPS (termasuk luar kota)

### Master: `sigaji_work_locations`

- Nama, lat/lon, **radius_m** (50–5000 m)
- Tipe: `kantor` | `site` | `dinas` | `mess` | `lainnya`

### Penugasan HRD: `sigaji_location_assignments`

- NIK + `location_id` + `date_from` … `date_to`
- `works_saturday = true` (default) — Sabtu boleh check-in di lokasi penugasan
- Contoh: tim proyek menginap di Mess X, Senin–Sabtu → HRD buat penugasan satu minggu ke lokasi Mess X

### Validasi check-in/out (server)

Untuk tanggal `work_date` dan NIK:

1. Ambil penugasan aktif (`date_from <= work_date <= date_to`).
2. Jika ada penugasan → GPS harus dalam radius lokasi penugasan.
3. Jika tidak ada penugasan → boleh lokasi bertipe `kantor` default tenant + lokasi “umum” yang HRD tandai untuk semua (opsional fase 2).
4. Hari Minggu: default libur (kecuali kebijakan khusus).
5. **Sabtu**: jika `works_saturday` pada penugasan = false, tolak; default **true**.

---

## 2. Check-in & check-out wajib

### Tabel: `sigaji_attendance_logs`

| Kolom | Keterangan |
|--------|------------|
| `event_type` | `check_in` \| `check_out` |
| `work_date` | Tanggal kerja (timezone PT, disarankan Asia/Jakarta di API) |
| `face_verified` | Wajib (APK) — validasi wajah on-device, tanpa simpan foto |
| `face_score` | Skor kemiripan 0–1 dari HP |
| `photo_path` | Kosong (legacy PWA/upload dinonaktifkan) |
| `lat`, `lon`, `accuracy_m` | GPS |
| `is_mock`, `flags` | Anti fake GPS |
| `validation_status` | `ok`, `pending_review`, `outside_geofence`, … |

**Unik:** satu `check_in` + satu `check_out` per NIK per `work_date`.

### Alur app

1. **Sekali:** enrollment wajah di APK (3 foto → vektor disimpan, foto tidak di server).
2. Pagi: check-in (validasi wajah di HP + GPS) → tidak bisa check-out sebelum check-in.
3. Sore: check-out (validasi wajah + GPS) → wajib sebelum tengah malam (aturan jam di API).
3. Jika hanya check-in tanpa check-out → status hari `incomplete` (HRD lihat di web).

### Sinkron ke gaji SiGaji

Setelah pasangan check-in/out **valid** → API/web set `absensi[nik][tanggal] = 'hadir'` (atau tetap HRD koreksi di kalender).

---

## 3. Template pengajuan cuti / izin / sakit

### Tabel: `sigaji_leave_requests`

| `request_type` | Lampiran | Setelah approve → absensi |
|----------------|----------|---------------------------|
| `cuti` | Opsional | `cuti` |
| `izin` | Opsional | `izin` |
| `sakit` | **Wajib** (`attachment_path`) | `sakit` |

Constraint SQL: baris `sakit` tanpa `attachment_path` **ditolak insert**.

### Approve (Admin / HRD di SiGaji web)

1. Antrian pending + preview surat (Storage signed URL).
2. Setujui → loop tanggal kerja (Senin–Sabtu sesuai penugasan / `hariKerja` perusahaan), skip libur nasional.
3. Tulis `absensi[nik][tgl] = absensi_status`.
4. Cek kuota cuti untuk tipe `cuti`; sakit/izin ikut aturan potongan master.
5. Hormati **periode snapshot terkunci** (sama seperti kalender sekarang).

---

## 4. Anti fake GPS (lapisan)

**App:** `Location.isMock()`, akurasi minimum, Play Integrity (disarankan).

**Server:**

- Geofence ke lokasi yang diizinkan hari itu
- Kecepatan / loncat lokasi tidak masuk akal
- EXIF foto vs GPS (opsional)
- **Luar radius** atau **GPS mock** → ditolak server (HTTP 422), **tidak** tersimpan; karyawan bisa langsung coba lagi
- **Akurasi GPS rendah** (>80 m) → `pending_review` tersimpan; HRD **Setujui** / **Tolak** di web (Absensi → Lokasi GPS → log harian)
- **Tolak** → status `rejected`, `hadir` di kalender dihapus; karyawan bisa check-in ulang
- **Setujui** → status `ok`; jika check-in & check-out keduanya OK → `absensi[nik][tanggal] = hadir`

Tidak ada jaminan 100% pada perangkat root; kombinasi server + review HRD yang realistis.

---

## 5. Hak akses

| Aksi | Admin | HRD | Karyawan |
|------|-------|-----|----------|
| CRUD lokasi kerja | ✓ | ✓ | — |
| CRUD penugasan lokasi | ✓ | ✓ | — |
| Check-in/out sendiri | ✓* | ✓* | ✓ |
| Ajuan cuti/izin/sakit | ✓* | ✓* | ✓ |
| Approve pengajuan | ✓ | ✓ | — |

\*Jika punya NIK di data karyawan.

RLS Supabase: isolasi **tenant_key** saja; filter role di **API Cloudflare** + SiGaji web (`CU.role`).

---

## 6. Urutan implementasi

| Fase | Status |
|------|--------|
| **A** SQL + grants | Skrip di `sql/` — jalankan di Supabase |
| **B** API Cloudflare | `functions/api/mobile-*.js` |
| **C** SiGaji web | Tab **Lokasi GPS** & **Pengajuan Cuti** + **Cuti Saya** (ajuan) |
| **D** PWA `/mobile/` (HP Android) | Siap — install ke layar utama |
| **E** APK Play Store (native) | Belum — lihat `ANDROID_APP_GUIDE.md` |
| **F** Play Integrity | Belum |

---

## 7. Setup Supabase

1. SQL Editor → `sql/supabase_sigaji_mobile_attendance.sql`
2. `sql/supabase_data_api_grants.sql` (grant tabel mobile)
3. Storage → bucket `sigaji-mobile` (private)
4. Tenant ke-2 → tambah policy di `supabase_tenant_add.sql` (bagian 9 mobile)

---

## 8. Endpoint API (rencana)

| Method | Path | Role |
|--------|------|------|
| POST | `/api/mobile-face` | Karyawan: `status`, `enroll`, `get_embedding`; HRD: `delete` + `nik` |
| POST | `/api/mobile-attendance` | Karyawan: `check_in`, `check_out`, `day_status` |
| POST | `/api/mobile-attendance` | HRD: `action=decide` + `approve` \| `reject` |
| GET | `/api/mobile-attendance?work_date=` | HRD: log check-in/out |
| POST | `/api/leave-request` | Karyawan+ |
| POST | `/api/leave-decide` | Admin, HRD |
| CRUD | `/api/work-locations` | Admin, HRD |
| CRUD | `/api/location-assignments` | Admin, HRD |

Semua pakai `Authorization: Bearer` Supabase + `SIGAJI_TENANT_KEY` di server.

---

## 9. App Android

- Login: Supabase email (sama SiGaji)
- NIK dari baris user SiGaji yang cocok `auth_uid` / email
- Satu APK multi-tenant: `SIGAJI_TENANT_KEY` / URL di build flavor atau QR setup (fase 2)

Teknologi disarankan: **Kotlin + Jetpack Compose** atau **Flutter** jika ingin iOS nanti.
