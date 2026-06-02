# SiGaji Absen — Flutter (APK internal)

Aplikasi Android internal untuk karyawan: **check-in / check-out** (foto + GPS) dan **pengajuan cuti / izin / sakit**. Memakai API SiGaji yang sama dengan PWA `/mobile/`.

## Prasyarat

- [Flutter SDK](https://docs.flutter.dev/get-started/install) 3.16+ (stable)
- Android Studio atau Android SDK (untuk build APK)
- Backend SiGaji sudah deploy (`mobile-attendance`, `mobile-leave`, `mobile-upload`, `mobile-notifications`)
- SQL mobile + storage + notifikasi sudah di Supabase

## Setup pertama di HP

1. Build & install APK (lihat bawah).
2. Buka app → **Pengaturan server**:
   - **URL API:** `https://www.cemerlang.online/api/` (sesuaikan domain Anda, harus diakhiri `/`)
   - **Supabase URL** & **anon key** (sama `js/config.js` / SiGaji web)
   - **Tenant key:** `main` (jika pakai tenant lain, isi sesuai `SIGAJI_TENANT_KEY`)
3. Login email + sandi Supabase (user harus punya **NIK** di Manajemen User).

## Persiapan project (sekali)

Jika folder `android/` belum lengkap (ikon launcher, dll.), jalankan di dalam `sigaji_mobile`:

```bash
flutter create . --project-name sigaji_mobile --org com.sigaji
```

Perintah ini melengkapi file Android tanpa menghapus kode di `lib/`.

## Build APK (gratis, tanpa Play Store)

```bash
cd sigaji_mobile
flutter pub get
flutter build apk --release
```

File APK:

`build/app/outputs/flutter-apk/app-release.apk`

Bagikan file itu ke karyawan (Drive, WhatsApp internal, dll.) → izinkan **Install dari sumber tidak dikenal**.

### Build dengan default server (opsional)

Anda bisa pre-fill lewat file `lib/config/build_defaults.dart` (salin dari `build_defaults.example.dart`) sebelum build, agar karyawan tidak perlu ketik URL.

## Fitur

| Fitur | API |
|--------|-----|
| Login | Supabase Auth |
| Status hari | `POST mobile-attendance` `day_status` |
| Check-in/out | `mobile-upload` + `mobile-attendance` |
| Cuti / izin / sakit | `mobile-leave` (+ validasi kuota cuti) |
| Notifikasi setuju/tolak | `mobile-notifications` |

## Izin Android

Kamera, lokasi (GPS), internet — diminta saat dipakai.

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Upload foto gagal | Jalankan `sql/supabase_storage_sigaji_mobile.sql`, deploy `mobile-upload` |
| Belum ada penugasan | HRD buat lokasi + penugasan di web SiGaji |
| Login OK tapi error NIK | Isi NIK di user SiGaji |
| Ubah Supabase URL | Buka pengaturan server di app, simpan, **tutup app sepenuhnya**, buka lagi |

## Dokumen terkait

- [`docs/ANDROID_APP_GUIDE.md`](../docs/ANDROID_APP_GUIDE.md)
- [`docs/MOBILE_ATTENDANCE_APP.md`](../docs/MOBILE_ATTENDANCE_APP.md)
