@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set "ENV_FILE=scripts\backup-supabase.env"
if not exist "%ENV_FILE%" (
  echo.
  echo [ERROR] File %ENV_FILE% belum ada.
  echo Salin dari scripts\backup-supabase.example.env lalu isi SUPABASE_DB_URL.
  echo.
  pause
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (`findstr /v /r "^#" "%ENV_FILE%" ^| findstr /v /r "^$"`) do (
  if /i "%%A"=="SUPABASE_DB_URL" set "SUPABASE_DB_URL=%%B"
  if /i "%%A"=="BACKUP_DIR" set "BACKUP_DIR=%%B"
)

if "%SUPABASE_DB_URL%"=="" (
  echo [ERROR] SUPABASE_DB_URL kosong di %ENV_FILE%
  pause
  exit /b 1
)

where pg_dump >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] pg_dump tidak ditemukan di PATH.
  echo Install PostgreSQL client tools dari https://www.postgresql.org/download/windows/
  echo Centang "Command Line Tools" saat install, lalu buka CMD baru.
  echo.
  pause
  exit /b 1
)

if "%BACKUP_DIR%"=="" set "BACKUP_DIR=%CD%\backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%T"
set "OUT=%BACKUP_DIR%\sigaji_supabase_%STAMP%.dump"

echo.
echo Backup Supabase (format custom PostgreSQL, BUKAN JSON)...
echo Tujuan: %OUT%
echo.

pg_dump "%SUPABASE_DB_URL%" --format=custom --no-owner --no-acl --file="%OUT%"
if errorlevel 1 (
  echo.
  echo [GAGAL] Cek password, host DIRECT db.xxx.supabase.co, dan firewall.
  pause
  exit /b 1
)

echo.
echo [OK] Backup selesai.
echo File: %OUT%
echo.
echo Restore nanti (hati-hati, timpa data): pg_restore -d "CONNECTION_STRING" --clean --if-exists "%OUT%"
echo.
pause
endlocal
