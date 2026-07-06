#!/usr/bin/env bash
# Hourly cron entrypoint for wordbase memory enrich.
#
# Reads APP_API_BASE_URL from the shell env or .env.local (default: http://localhost:5173).
# Production API is only used when APP_API_BASE_URL points at learn.lexiland.cc and
# ALLOW_PRODUCTION_BULK_API=1 (GitHub Actions sets both explicitly).
#
# Local cron example:
#   0 * * * * cd /path/to/lexiland && npm run wordbase:enrich-memory:cron >> /tmp/wordbase-enrich.log 2>&1
#
# Requires `npm run dev` when using localhost.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

# shellcheck source=load-env-local.sh
source "$DIR/load-env-local.sh"
resolve_bulk_api_env

if [[ -z "${WORDBASE_ENRICH_LIMIT:-}" ]]; then
  WORDBASE_ENRICH_LIMIT="$(load_env_local_value WORDBASE_ENRICH_LIMIT || true)"
fi

LIMIT="${WORDBASE_ENRICH_LIMIT:-8}"

echo "wordbase enrich cron: API target ${APP_API_BASE_URL}" >&2

cd "$ROOT"
exec bash "$DIR/run-enrich-memory.sh" --limit "$LIMIT" "$@"
