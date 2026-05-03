@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SiGaji — server lokal
cls
echo.
echo  ========================================
echo    SiGaji — folder: %CD%
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 goto TRY_PYTHON

echo  Pakai Node.js. Buka di browser:
echo    http://localhost:3333
echo.
echo  Tunggu sampai muncul "Accepting connections", lalu klik link di atas.
echo  Untuk stop server: tutup jendela ini atau tekan Ctrl+C lalu Enter.
echo.

REM serve: tanpa -s agar file statis semua terkirim normal
npx --yes serve@14 . --listen 3333
set ERR=%ERRORLEVEL%
echo.
if %ERR% neq 0 (
  echo  [Perintah di atas gagal / server berhenti. Kode keluar: %ERR%
  echo  Pastikan internet aktif (pertama kali npx mengunduh paket).
)
goto SELESAI

:TRY_PYTHON
where py >nul 2>&1
if not errorlevel 1 (
  echo  Pakai Python ^(py^). Buka: http://localhost:8000
  echo.
  py -m http.server 8000
  goto SELESAI
)
where python >nul 2>&1
if not errorlevel 1 (
  echo  Pakai Python. Buka: http://localhost:8000
  echo.
  python -m http.server 8000
  goto SELESAI
)

echo  [ERROR] Node.js dan Python tidak ketemu di PATH.
echo.
echo  Pasang Node.js dari https://nodejs.org
echo  Saat install, centang "Add to PATH", RESTART komputer jika perlu,
echo  lalu jalankan ulang start-sigaji.cmd
echo.
pause
exit /b 1

:SELESAI
echo.
echo  ------------------------------------------------------
pause
