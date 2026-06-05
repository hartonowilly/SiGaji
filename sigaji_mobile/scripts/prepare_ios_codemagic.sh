#!/usr/bin/env bash
# Codemagic (macOS): siapkan iOS CocoaPods + ML Kit. Jalankan dari folder sigaji_mobile.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Backup Info.plist"
INFO_BAK="$(mktemp)"
cp ios/Runner/Info.plist "$INFO_BAK"

echo "==> Regenerate iOS (CocoaPods, bukan Swift Package Manager)"
flutter config --no-enable-swift-package-manager
flutter create . --org com.sigaji --project-name sigaji_mobile --platforms=ios

echo "==> Restore Info.plist (izin kamera/GPS)"
cp "$INFO_BAK" ios/Runner/Info.plist
rm -f "$INFO_BAK"

echo "==> Podfile SiGaji (ML Kit 15.5 + permission_handler)"
cp scripts/ios/Podfile ios/Podfile

echo "==> Flutter pub get + CocoaPods"
flutter pub get
cd ios
pod install --repo-update

echo "==> iOS siap build"
