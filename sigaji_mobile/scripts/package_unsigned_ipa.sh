#!/usr/bin/env bash
# Bungkus Runner.app jadi .ipa unsigned — untuk Sideloadly / AltStore (Apple ID gratis, 7 hari).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP="build/ios/iphoneos/Runner.app"
OUT_DIR="build/ios/sideload"
IPA="$OUT_DIR/sigaji-absen-unsigned.ipa"

if [ ! -d "$APP" ]; then
  echo "Runner.app tidak ada — jalankan: flutter build ios --release --no-codesign"
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -rf Payload
mkdir Payload
cp -r "$APP" Payload/
rm -f "$IPA"
(cd . && zip -qr "$IPA" Payload)
rm -rf Payload

echo "IPA unsigned: $IPA ($(du -h "$IPA" | cut -f1))"
