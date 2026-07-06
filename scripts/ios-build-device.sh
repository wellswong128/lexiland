#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT_DIR/ios/App/App.xcodeproj"
SCHEME="App"
PUBLIC_INDEX="$ROOT_DIR/ios/App/App/public/index.html"

if [[ ! -f "$PUBLIC_INDEX" ]]; then
  cat <<'EOF'
Web assets are missing from the iOS project.

Run this first:
  npm run build:cap && npx cap copy ios

Then rebuild for device.
EOF
  exit 1
fi

DEVICE_ID="${IOS_DEVICE_ID:-}"
if [[ -z "$DEVICE_ID" ]]; then
  DEVICE_ID="$(
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -showdestinations 2>/dev/null |
      awk -F"id:" '/platform:iOS, arch:arm64/ { split($2, parts, ","); gsub(/ }.*/, "", parts[1]); print parts[1]; exit }'
  )"
fi

if [[ -z "$DEVICE_ID" ]]; then
  cat <<'EOF'
No physical iPhone detected.

1. Connect your iPhone with USB (or enable wireless debugging)
2. Unlock the phone and tap Trust This Computer
3. Verify in Xcode → Window → Devices and Simulators
4. Re-run:
     npm run cap:ios:device

Or open Xcode manually:
     npm run cap:ios
EOF
  exit 1
fi

echo "Building App for device $DEVICE_ID ..."
DERIVED_DATA="$ROOT_DIR/ios/DerivedData"
mkdir -p "$DERIVED_DATA"

xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates \
  build

APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphoneos/App.app"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Build finished but App.app was not found at:"
  echo "  $APP_PATH"
  exit 1
fi

echo
echo "Installing on device ..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

echo
echo "Installed. Open 力思樂園 on your iPhone."
