#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$DIR/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Creating Python venv in scripts/wordbase_import/.venv ..."
  python3 -m venv "$DIR/.venv"
  "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
fi

exec "$PYTHON" "$DIR/fix_incomplete_translations.py" "$@"
