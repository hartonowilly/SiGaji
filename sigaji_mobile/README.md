# SiGaji Absen — Flutter (Android & iOS internal)

Aplikasi internal untuk karyawan: **check-in / check-out** (MobileFaceNet + GPS) dan **pengajuan cuti / izin / sakit**. Memakai API SiGaji yang sama dengan PWA `/mobile/`.

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

**Jika macet di `[1/6] android-arm-profile`:** baca [`docs/BUILD_MACET.md`](docs/BUILD_MACET.md) — unduh engine dulu, bukan error project.

```bash
cd sigaji_mobile
powershell -ExecutionPolicy Bypass -File scripts/download_face_model.ps1
flutter pub get
flutter precache --android -v
flutter build apk --release --target-platform android-arm64
```

Model **MobileFaceNet** (~5 MB) wajib ada di `assets/models/mobilefacenet.tflite` sebelum build.

Atau di Windows: jalankan `scripts\build_apk.bat` (unduh model otomatis).

File APK (ARM64, untuk HP modern):

`build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`

Bagikan file itu ke karyawan (Drive, WhatsApp internal, dll.) → izinkan **Install dari sumber tidak dikenal**.

## Build iOS (Codemagic)

Config ada di **`codemagic.yaml` di root repo** (bukan di folder ini). Branch: **`master`**, path: **`sigaji_mobile`**.

### Workflow Codemagic

| Workflow | Output | Butuh Apple Developer? |
|----------|--------|------------------------|
| **`sigaji-mobile-ios-sideload`** | `sigaji-absen-unsigned.ipa` | **Tidak** — sideload 7 hari |
| `sigaji-mobile-android` | `.apk` ARM64 | Tidak |
| `sigaji-mobile-ios` | `.ipa` Ad Hoc | Ya ($99/tahun) |
| `sigaji-mobile-ios-testflight` | `.ipa` TestFlight | Ya ($99/tahun) |

### Error Codemagic: "Scheme Runner not found"

1. **Project path** harus `sigaji_mobile` (lihat bagian error pubspec di atas).
2. **Build configuration** pakai `codemagic.yaml` saja — matikan Workflow Editor iOS ganda di Settings.
3. Push commit terbaru (berisi `ios/Podfile` + `Runner.xcscheme` shared).
4. Jalankan workflow **SiGaji iOS Sideload 7 hari** — step `Prepare iOS` akan restore scheme.

### Error Codemagic: "Directory was not found" / pubspec di root

Flutter ada di **`sigaji_mobile/`**, bukan di root repo.

1. Codemagic → aplikasi SiGaji → **Settings** → **Build**
2. **Project path** → klik ikon **Rescan** → pilih **`sigaji_mobile`**
3. Pastikan build pakai **`codemagic.yaml`** dari root repo
4. Jalankan ulang workflow (mis. **SiGaji iOS Sideload 7 hari**)

### Sideload 7 hari (gratis, tanpa Apple Developer)

1. **Codemagic** → jalankan manual workflow **`SiGaji iOS Sideload 7 hari (gratis)`**.
2. Unduh artifact **`sigaji-absen-unsigned.ipa`**.
3. Di PC Windows/Mac, install **[Sideloadly](https://sideloadly.io/)** (gratis).
4. Sambungkan iPhone ke USB → buka Sideloadly:
   - Masukkan **Apple ID biasa** (bukan developer, gratis)
   - Pilih file `.ipa`
   - Klik **Start**
5. Di iPhone: **Pengaturan → Umum → VPN & Pengelolaan Perangkat** → **Percayai** profil developer.
6. App aktif **±7 hari** → ulangi langkah 3–5 (refresh sideload).

**Batasan Apple ID gratis:** max ~3 app sideload, harus refresh mingguan, butuh PC + kabel USB saat install/refresh.

### Opsi berbayar (tanpa refresh 7 hari)

Butuh **Apple Developer $99/tahun** + workflow `sigaji-mobile-ios` (Ad Hoc) atau TestFlight.

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

## Izin perangkat

Kamera, lokasi (GPS), internet — diminta saat dipakai (Android & iOS).

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
