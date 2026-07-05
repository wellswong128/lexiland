#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=android-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/android-env.sh"

echo "Stopping stuck Android emulators..."
pkill -9 -f "qemu-system" 2>/dev/null || true
pkill -9 -f "netsimd" 2>/dev/null || true
sleep 1

echo "Restarting adb..."
adb kill-server 2>/dev/null || true
sleep 1
adb start-server

echo
adb devices
echo
cat <<'EOF'
Done. Next steps in Android Studio:
1. Device Manager → stop Pixel 7 if it still shows as running
2. Start Pixel 7 once (wait for the home screen)
3. Click Run ▶ only after the device appears online

Tip: Do not click Run while the emulator is still booting.
EOF
