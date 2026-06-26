#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat <<EOF
Parallel Complete-phase imports are disabled.

This script used to start multiple Wordbase writers that shared the same
Supabase session file. Supabase refresh tokens are single-use, so concurrent
writers can invalidate each other's tokens and stop mid-batch after partial
writes.

Run one Complete-phase import at a time instead, for example:
  $DIR/run.sh --resume --progress-file "$DIR/progress-batch-b.json" --report-dir "$DIR/reports/batch-b"
EOF

exit 2
