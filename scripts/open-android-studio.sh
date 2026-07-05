#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

find_android_studio() {
  if [[ -n "${CAPACITOR_ANDROID_STUDIO_PATH:-}" && -d "$CAPACITOR_ANDROID_STUDIO_PATH" ]]; then
    echo "$CAPACITOR_ANDROID_STUDIO_PATH"
    return 0
  fi

  local candidates=(
    "/Applications/Android Studio.app"
    "$HOME/Applications/Android Studio.app"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

if ! studio_path="$(find_android_studio)"; then
  cat <<'EOF'
Android Studio was not found.

Install it, then run this command again:
  brew install --cask android-studio

Or download from:
  https://developer.android.com/studio

After install, open the project manually:
  Android Studio → Open → select the "android" folder in this repo

You can also set a custom app path:
  export CAPACITOR_ANDROID_STUDIO_PATH="/path/to/Android Studio.app"

Build a debug APK without opening the IDE:
  npm run cap:android:apk
EOF
  exit 1
fi

open -a "$studio_path" "$ANDROID_DIR"
