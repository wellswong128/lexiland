#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
PYTHON="$DIR/.venv/bin/python"
COCA_DIR="${COCA_TERMS_DIR:-$REPO_ROOT/data/coca20000}"

if [[ ! -x "$PYTHON" ]]; then
  echo "Creating Python venv in scripts/wordbase_import/.venv ..."
  python3 -m venv "$DIR/.venv"
  "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
fi

if [[ $# -eq 0 ]]; then
  cat <<EOF
Import COCA term list file(s) into wordbase.

Usage:
  $0 --terms-file $COCA_DIR/coca-20000-part-1.txt [import options...]

Examples:
  $0 --login --resume \\
    --terms-file $COCA_DIR/coca-20000-part-1.txt \\
    --progress-file $DIR/progress-coca-part-1.json \\
    --report-dir $DIR/reports/coca-part-1

  $0 --dry-run --limit-terms 5 \\
    --terms-file $COCA_DIR/coca-20000-part-1.txt \\
    --progress-file $DIR/progress-coca-part-1.json \\
    --report-dir $DIR/reports/coca-part-1

Run all 5 parts in parallel:
  $DIR/run-coca-parallel.sh
EOF
  exit 1
fi

exec env PYTHONUNBUFFERED=1 "$PYTHON" "$DIR/import_words_from_terms.py" "$@"
