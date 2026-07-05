#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=android-env.sh
source "$ROOT_DIR/scripts/android-env.sh"

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  cat <<'EOF'
Java was not found.

Install Android Studio (includes JDK):
  brew install --cask android-studio

Or set JAVA_HOME to a JDK 17+ install.
EOF
  exit 1
fi

cd "$ROOT_DIR/android"
./gradlew assembleDebug

APK="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
echo
echo "Debug APK built:"
echo "  $APK"

if adb devices | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
  echo
  echo "Installing on connected device..."
  adb install -r "$APK"
  echo "Installed. Open 力思樂園 on your phone."
else
  echo
  cat <<'EOF'
No phone connected yet.

1. Enable USB debugging on your Android phone
2. Connect with a USB cable and tap Allow
3. Verify:
     adb devices
4. Install the APK:
     adb install -r android/app/build/outputs/apk/debug/app-debug.apk
EOF
fi
