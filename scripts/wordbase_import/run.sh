#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$DIR/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Creating Python venv in scripts/wordbase_import/.venv ..."
  python3 -m venv "$DIR/.venv"
  "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
fi

# shellcheck source=resolve-local-api.sh
source "$DIR/resolve-local-api.sh"
prepare_bulk_api_env "$@"

exec env PYTHONUNBUFFERED=1 "$PYTHON" "$DIR/import_words_from_images.py" "$@"
