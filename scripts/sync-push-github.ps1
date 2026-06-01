# Sinkron folder kerja SiGaji ke repo GitHub lalu push (Cloudflare Pages build dari Git).
# Jalankan dari PowerShell:
#   cd C:\Users\harto\Downloads\sigaji-app
#   .\scripts\sync-push-github.ps1

$ErrorActionPreference = 'Stop'
$Src = Split-Path $PSScriptRoot -Parent
$Repo = 'C:\Users\harto\Downloads\SiGaji'
$Dest = Join-Path $Repo 'sigaji-app'

if (-not (Test-Path (Join-Path $Repo '.git'))) {
  Write-Host 'Repo Git tidak ditemukan di' $Repo
  Write-Host 'Clone: git clone https://github.com/hartonowilly/SiGaji.git' $Repo
  exit 1
}

Write-Host "Copy: $Src -> $Dest"
$exclude = @('.git', 'node_modules', 'sigaji-app', 'SiGaji', '_backup-before-kompgaji')
Get-ChildItem $Src -Force | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
  if ($_.PSIsContainer) {
    robocopy $_.FullName (Join-Path $Dest $_.Name) /MIR /XD .git node_modules SiGaji sigaji-app _backup-before-kompgaji /NFL /NDL /NJH /NJS | Out-Null
  } else {
    Copy-Item $_.FullName (Join-Path $Dest $_.Name) -Force
  }
}

Push-Location $Repo
git status -sb
$changes = git status --porcelain
if (-not $changes) {
  Write-Host 'Tidak ada perubahan setelah copy.'
  Pop-Location
  exit 0
}

git add sigaji-app
git commit -m "deploy: SiGaji 11.2.2 Cloudflare /api registrasi"
git push origin main
Pop-Location
Write-Host 'Selesai. Tunggu Cloudflare Pages deploy, lalu buka:'
Write-Host '  https://www.cemerlang.online/?b=11.2.2'
Write-Host 'Cek View Source: SIGAJI_BUILD=11.2.2 dan app-access.js?v=11.2.2'
