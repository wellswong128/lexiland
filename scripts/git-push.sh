#!/usr/bin/env bash
set -euo pipefail

KEY="${HOME}/.ssh/lexiland_ed25519"
PUB_KEY="${KEY}.pub"

if [[ -f "$KEY" ]]; then
  ssh-add --apple-use-keychain "$KEY" 2>/dev/null || ssh-add "$KEY" 2>/dev/null || true
fi

if ! git push "$@"; then
  echo ""
  echo "Git push failed."
  echo ""
  if [[ -f "$PUB_KEY" ]]; then
    fingerprint="$(ssh-keygen -lf "$PUB_KEY" | awk '{print $2}')"
    echo "SSH key: $PUB_KEY"
    echo "Fingerprint: $fingerprint"
    echo ""
    echo "If you see 'Permission denied (publickey)', add this public key to GitHub:"
    echo "  https://github.com/settings/ssh/new"
    echo ""
    cat "$PUB_KEY"
  fi
  exit 1
fi
