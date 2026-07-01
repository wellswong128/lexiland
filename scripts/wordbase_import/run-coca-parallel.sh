#!/usr/bin/env bash
set -euo pipefail

# Run one import worker per COCA part file in parallel.
# Each part MUST have its own progress + report dir.
#
# First time (or expired session):
#   ./scripts/wordbase_import/run-coca-terms.sh --login --resume \
#     --terms-file data/coca20000/coca-20000-part-1.txt \
#     --progress-file scripts/wordbase_import/progress-coca-part-1.json \
#     --report-dir scripts/wordbase_import/reports/coca-part-1
#
# Then:
#   ./scripts/wordbase_import/run-coca-parallel.sh

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
RUN="$DIR/run-coca-terms.sh"
PYTHON="$DIR/.venv/bin/python"
COCA_DIR="${COCA_TERMS_DIR:-$REPO_ROOT/data/coca20000}"
LOG_DIR="$DIR/reports/parallel-coca-logs"
mkdir -p "$LOG_DIR"

if [[ ! -x "$PYTHON" ]]; then
  echo "Creating Python venv in scripts/wordbase_import/.venv ..."
  python3 -m venv "$DIR/.venv"
  "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
fi

echo "Checking Supabase import session..."
if ! (cd "$DIR" && "$PYTHON" - <<'PY'
import sys
from config import load_settings
from auth import AuthError, ImportAuth

settings = load_settings()
try:
    ImportAuth(
        supabase_url=settings.supabase_url,
        supabase_anon_key=settings.supabase_anon_key,
        session_path=settings.session_path,
        auth_redirect_url=settings.auth_redirect_url,
        import_user_email=settings.import_user_email,
        import_user_password=settings.import_user_password,
    )
except AuthError as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(2) from error
PY
); then
  echo
  echo "Session check failed. Refresh login once, then rerun this script:"
  echo "  $RUN --login --resume \\"
  echo "    --terms-file $COCA_DIR/coca-20000-part-1.txt \\"
  echo "    --progress-file $DIR/progress-coca-part-1.json \\"
  echo "    --report-dir $DIR/reports/coca-part-1"
  exit 2
fi

run_coca_part() {
  local part="$1"
  local terms_file="$COCA_DIR/coca-20000-part-${part}.txt"
  local progress_file="$DIR/progress-coca-part-${part}.json"
  local report_dir="$DIR/reports/coca-part-${part}"
  local log_file="$LOG_DIR/part-${part}.log"

  if [[ ! -f "$terms_file" ]]; then
    echo "Skipping part-${part}: file not found ($terms_file)"
    return 0
  fi

  mkdir -p "$report_dir"

  echo "Starting part-${part}"
  echo "  terms-file: ${terms_file}"
  echo "  progress:   ${progress_file}"
  echo "  report-dir: ${report_dir}"
  echo "  log:        ${log_file}"

  nohup env PYTHONUNBUFFERED=1 "$RUN" \
    --resume \
    --terms-file "$terms_file" \
    --progress-file "$progress_file" \
    --report-dir "$report_dir" \
    >"$log_file" 2>&1 &
  echo $! >"$LOG_DIR/part-${part}.pid"
}

for part in 1 2 3 4 5; do
  run_coca_part "$part"
done

echo
echo "Parallel COCA imports started (5 workers)."
echo "Tail logs with:"
for part in 1 2 3 4 5; do
  echo "  tail -f $LOG_DIR/part-${part}.log"
done
