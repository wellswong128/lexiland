#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORDBASE_IMPORT="$DIR/../wordbase_import"
PYTHON="$WORDBASE_IMPORT/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Creating Python venv in scripts/wordbase_import/.venv ..."
  python3 -m venv "$WORDBASE_IMPORT/.venv"
  "$WORDBASE_IMPORT/.venv/bin/pip" install -r "$WORDBASE_IMPORT/requirements.txt"
fi

exec "$PYTHON" "$DIR/enrich_word_group_list.py" "$@"
