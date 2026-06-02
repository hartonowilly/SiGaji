# App Android SiGaji — panduan

## Status saat ini

| Komponen | Status |
|----------|--------|
| Supabase (tabel + Storage) | Anda sudah jalankan |
| API `/api/mobile-*` | Sudah di deploy dengan SiGaji |
| SiGaji web (HRD approve) | Tab Lokasi GPS & Pengajuan Cuti |
| **APK Play Store** | **Belum** — project native belum dibuat |
| **PWA “SiGaji Absen”** | **Sudah** di folder `mobile/` |

Untuk kebutuhan operasional **sekarang**, pakai **PWA** (buka di Chrome Android, tambah ke layar utama). Perilaku sama dengan rencana app: login email Supabase, check-in/out foto+GPS, ajuan cuti/sakit.

---

## Cara pakai di HP Android (tanpa Play Store)

1. Deploy web terbaru (folder `mobile/` ikut ter-upload ke Cloudflare).
2. Buka di Chrome:  
   `https://www.cemerlang.online/mobile/`  
   (ganti domain Anda jika beda).
3. Login dengan **email + sandi Supabase** (sama SiGaji).
4. Pastikan user punya **NIK** di Manajemen User.
5. Menu Chrome (⋮) → **Tambahkan ke Layar utama** / **Install app**.
6. Izinkan **Kamera** dan **Lokasi** saat diminta.

HRD tetap approve di SiGaji web → **Absensi & Cuti → Pengajuan Cuti**.

---

## Syarat agar check-in berhasil

1. HRD sudah buat **lokasi GPS** + **penugasan** untuk NIK Anda (tab Lokasi GPS).
2. Anda berada dalam **radius** lokasi (mis. 150–300 m).
3. Bucket Storage **`sigaji-mobile`** ada dan policy mengizinkan upload user login.
4. Check-in dulu, lalu **check-out wajib** sebelum pulang.

---

## APK native (Flutter / Kotlin) — fase berikutnya

APK terpisah berguna jika Anda butuh:

- Play Integrity / deteksi fake GPS lebih kuat
- Notifikasi push
- Offline queue
- Branding di Play Store

API **sudah siap** — developer Android cukup memanggil endpoint yang sama (lihat `docs/MOBILE_ATTENDANCE_APP.md`).

Contoh kontrak:

```
POST /api/mobile-attendance
  { "action": "check_in"|"check_out", "lat", "lon", "photo_path", "is_mock", ... }

POST /api/mobile-leave
  { "action": "submit", "request_type", "date_from", "date_to", "attachment_path" }
```

Upload foto: Supabase Storage `sigaji-mobile/{tenant}/attendance/{nik}/...`

---

## Upload foto gagal — perbaikan (wajib)

1. **Supabase SQL Editor** → jalankan **`sql/supabase_storage_sigaji_mobile.sql`** (bucket + policy).
2. **Deploy ulang** Cloudflare (file baru `functions/api/mobile-upload.js`).
3. Di HP: hard refresh `/mobile/` atau hapus cache Chrome.

Upload sekarang lewat **API server** (`/api/mobile-upload`), bukan langsung dari browser ke Storage — lebih andal di HP.

Jika masih gagal, catat **teks error** di toast (mis. bucket belum ada, file max 5 MB, NIK kosong).

---

## Ringkasan

- **Sekarang:** pakai **`/mobile/`** sebagai “app Android” (PWA).
- **Nanti:** APK native bisa dibangun di atas API yang sama; belum ada di repo ini.

Jika upload foto error, kirim pesan error di toast — biasanya bucket/policy Storage.
