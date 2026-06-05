# Unduh MobileFaceNet (~5 MB) — wajib sebelum build APK.
$ErrorActionPreference = "Stop"
$dir = Join-Path $PSScriptRoot "..\assets\models"
$out = Join-Path $dir "mobilefacenet.tflite"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

if ((Test-Path $out) -and (Get-Item $out).Length -gt 500000) {
  Write-Host "Model sudah ada: $out"
  exit 0
}

$url = "https://github.com/MCarlomagno/FaceRecognitionAuth/raw/master/assets/mobilefacenet.tflite"
Write-Host "Mengunduh: $url"
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
$sz = (Get-Item $out).Length
if ($sz -lt 500000) {
  Write-Host "ERROR: file terlalu kecil ($sz bytes)"
  exit 1
}
Write-Host "OK ($sz bytes) -> $out"
