#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=android-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/android-env.sh"

echo "Checking for Android devices..."
DEVICES="$(adb devices | awk 'NR>1 && $2=="device"{print $1}')"

if [[ -z "$DEVICES" ]]; then
  cat <<'EOF'
adb: no devices found.

On your Android phone:
1. Settings → About phone → tap Build number 7 times
2. Settings → Developer options → enable USB debugging
3. Connect USB cable → tap Allow on the phone

Then run:
  adb devices

You should see your phone listed as "device".
EOF
  exit 1
fi

echo "$DEVICES"
echo "Device ready."
