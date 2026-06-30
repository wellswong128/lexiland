#!/usr/bin/env bash
set -euo pipefail

# Run one PDF import worker per folder in parallel.
# Each folder MUST have its own progress + report dir (never share progress-pdf.json).
#
# First time (or expired session):
#   ./scripts/wordbase_import/run-pdf.sh --login --resume \
#     --pdf-dir /Users/mac/racer/book/dk1w1 \
#     --progress-file scripts/wordbase_import/progress-pdf-dk1w1.json \
#     --report-dir scripts/wordbase_import/reports/pdf-dk1w1
#
# Then:
#   ./scripts/wordbase_import/run-pdf-parallel.sh

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$DIR/run-pdf.sh"
PYTHON="$DIR/.venv/bin/python"
LOG_DIR="$DIR/reports/parallel-pdf-logs"
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
  echo "  $RUN --login --resume \\"
  echo "    --pdf-dir /Users/mac/racer/book/dk1w1 \\"
  echo "    --progress-file $DIR/progress-pdf-dk1w1.json \\"
  echo "    --report-dir $DIR/reports/pdf-dk1w1"
  exit 2
fi

run_pdf_batch() {
  local name="$1"
  local pdf_dir="$2"
  local progress_file="$3"
  local report_dir="$4"
  local log_file="$LOG_DIR/batch-${name}.log"

  if [[ ! -d "$pdf_dir" ]]; then
    echo "Skipping batch-${name}: folder not found ($pdf_dir)"
    return 0
  fi

  mkdir -p "$report_dir"

  echo "Starting batch-${name}"
  echo "  pdf-dir:    ${pdf_dir}"
  echo "  progress:   ${progress_file}"
  echo "  report-dir: ${report_dir}"
  echo "  log:        ${log_file}"

  nohup env PYTHONUNBUFFERED=1 "$RUN" \
    --resume \
    --pdf-dir "$pdf_dir" \
    --progress-file "$progress_file" \
    --report-dir "$report_dir" \
    >"$log_file" 2>&1 &
  echo $! >"$LOG_DIR/batch-${name}.pid"
}

run_pdf_batch w1 "/Users/mac/racer/book/dk1w1" "$DIR/progress-pdf-dk1w1.json" "$DIR/reports/pdf-dk1w1"
run_pdf_batch w2 "/Users/mac/racer/book/dk1w2" "$DIR/progress-pdf-dk1w2.json" "$DIR/reports/pdf-dk1w2"
run_pdf_batch w3 "/Users/mac/racer/book/dk1w3" "$DIR/progress-pdf-dk1w3.json" "$DIR/reports/pdf-dk1w3"

echo
echo "Parallel PDF imports started."
echo "Tail logs with:"
echo "  tail -f $LOG_DIR/batch-w1.log"
echo "  tail -f $LOG_DIR/batch-w2.log"
echo "  tail -f $LOG_DIR/batch-w3.log"
