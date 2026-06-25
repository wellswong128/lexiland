#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$DIR/run.sh"
PYTHON="$DIR/.venv/bin/python"
LOG_DIR="$DIR/reports/parallel-logs"
mkdir -p "$LOG_DIR"

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
  echo "  $RUN --login --resume --progress-file $DIR/progress-batch-b.json --image-dir /Users/mac/racer/book/maths_b2"
  exit 2
fi

run_batch() {
  local name="$1"
  local image_dir="$2"
  local progress_file="$3"
  local report_dir="$4"
  local log_file="$LOG_DIR/batch-${name}.log"

  mkdir -p "$report_dir"

  echo "Starting batch-${name}"
  echo "  image-dir:  ${image_dir}"
  echo "  progress:   ${progress_file}"
  echo "  report-dir: ${report_dir}"
  echo "  log:        ${log_file}"

  nohup env PYTHONUNBUFFERED=1 "$RUN" \
    --resume \
    --image-dir "$image_dir" \
    --progress-file "$progress_file" \
    --report-dir "$report_dir" \
    >"$log_file" 2>&1 &
  echo $! >"$LOG_DIR/batch-${name}.pid"
}

run_batch b "/Users/mac/racer/book/maths_b2" "$DIR/progress-batch-b.json" "$DIR/reports/batch-b"
run_batch c "/Users/mac/racer/book/xdf" "$DIR/progress-batch-c.json" "$DIR/reports/batch-c"
run_batch d "/Users/mac/racer/book/xdf2" "$DIR/progress-batch-d.json" "$DIR/reports/batch-d"

echo
echo "Parallel imports started."
echo "Tail logs with:"
echo "  tail -f $LOG_DIR/batch-b.log"
echo "  tail -f $LOG_DIR/batch-c.log"
echo "  tail -f $LOG_DIR/batch-d.log"
