@echo off
chcp 65001 >nul
echo === SiGaji Mobile - Build APK (langkah aman) ===
echo.

cd /d "%~dp0.."
if not exist "pubspec.yaml" (
  echo ERROR: Jalankan dari folder sigaji_mobile
  pause
  exit /b 1
)

echo [1/4] Cek Flutter...
where flutter >nul 2>&1
if errorlevel 1 (
  echo Flutter tidak di PATH. Pakai path penuh, contoh:
  echo   C:\Users\harto\flutter\bin\flutter.bat doctor
  pause
  exit /b 1
)
flutter --version
echo.

echo [2/4] Unduh komponen Android (bisa 10-30 menit, JANGAN tutup)...
echo      Jika macet lama, ini unduh dari Google - cek internet / matikan VPN aneh.
flutter precache --android -v
if errorlevel 1 (
  echo precache gagal - lihat error di atas
  pause
  exit /b 1
)
echo.

echo [3/4] Dependencies...
flutter pub get
echo.

echo [4/4] Build APK release (hanya ARM64, lebih cepat)...
flutter build apk --release --target-platform android-arm64 -v
if errorlevel 1 (
  echo Build gagal
  pause
  exit /b 1
)

echo.
echo SUKSES. APK ada di:
echo   build\app\outputs\flutter-apk\app-arm64-v8a-release.apk
echo.
pause
