#!/usr/bin/env bash
# Codemagic (macOS): siapkan iOS CocoaPods + ML Kit. Jalankan dari folder sigaji_mobile.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCHEME_DIR="ios/Runner.xcodeproj/xcshareddata/xcschemes"
SCHEME_FILE="$SCHEME_DIR/Runner.xcscheme"

restore_shared_scheme() {
  mkdir -p "$SCHEME_DIR"
  if [ ! -f "$SCHEME_FILE" ]; then
    echo "==> Restore shared scheme Runner"
    cp scripts/ios/Runner.xcscheme "$SCHEME_FILE"
  fi
}

echo "==> Backup Info.plist"
INFO_BAK="$(mktemp)"
cp ios/Runner/Info.plist "$INFO_BAK"

if [ ! -f ios/Podfile ]; then
  echo "==> Regenerate iOS (CocoaPods)"
  flutter config --no-enable-swift-package-manager
  flutter create . --org com.sigaji --project-name sigaji_mobile --platforms=ios
else
  echo "==> Pakai ios/ dari repo (Podfile sudah ada)"
  flutter config --no-enable-swift-package-manager
fi

echo "==> Restore Info.plist (izin kamera/GPS)"
cp "$INFO_BAK" ios/Runner/Info.plist
rm -f "$INFO_BAK"

echo "==> Podfile SiGaji (ML Kit 15.5)"
cp scripts/ios/Podfile ios/Podfile
restore_shared_scheme

echo "==> Flutter pub get + CocoaPods"
flutter pub get
cd ios
pod install --repo-update

echo "==> Verifikasi scheme & workspace"
xcodebuild -list -workspace Runner.xcworkspace | tee /tmp/xcode_list.txt
grep -q "Runner" /tmp/xcode_list.txt

echo "==> iOS siap build"
