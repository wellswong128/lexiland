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

# shellcheck source=../wordbase_import/resolve-local-api.sh
source "$WORDBASE_IMPORT/resolve-local-api.sh"
prepare_bulk_api_env "$@"

exec "$PYTHON" "$DIR/enrich_word_group_list.py" "$@"
