#!/usr/bin/env bash

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  elif [[ -d "$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
    export JAVA_HOME="$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  fi
fi

if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
