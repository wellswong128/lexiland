#!/usr/bin/env bash
# Resolve APP_API_BASE_URL to a local dev server that can run AI import routes.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-env-local.sh
source "$DIR/load-env-local.sh"

block_production_bulk_api() {
  local preferred
  preferred="$(normalize_app_api_base_url "${APP_API_BASE_URL:-http://localhost:5173}")"
  export APP_API_BASE_URL="$preferred"

  if _production_bulk_api_blocked "$preferred"; then
    cat >&2 <<EOF
Refusing bulk enrich/import against production API ($preferred).

Bulk scripts call /api/complete-word, /api/word-memory-tips, and /api/word-memory-image.
Those routes burn Vercel Fluid Provisioned Memory when run against learn.lexiland.cc.

Fix:
  1. Remove APP_API_BASE_URL=https://learn.lexiland.cc from .env.local (if set)
  2. Start the local API: npm run dev
  3. Run scripts with the default local target:
       APP_API_BASE_URL=http://localhost:5173

To override intentionally (not recommended), set ALLOW_PRODUCTION_BULK_API=1.
EOF
    return 1
  fi

  if _is_production_api_base "$preferred" && _production_bulk_api_allowed; then
    echo "WARNING: bulk API target is production ($preferred)." >&2
    echo "This burns Vercel Fluid Provisioned Memory. Prefer localhost instead." >&2
    export APP_API_BASE_URL="$preferred"
    return 0
  fi

  export APP_API_BASE_URL="$preferred"
  return 0
}

prepare_bulk_api_env() {
  if _args_include_dry_run "$@"; then
    block_production_bulk_api
    return $?
  fi

  resolve_local_api_base
}

resolve_local_api_base() {
  local preferred="${APP_API_BASE_URL:-http://localhost:5173}"
  preferred="${preferred%/}"

  if ! block_production_bulk_api; then
    return 1
  fi

  preferred="${APP_API_BASE_URL:-$preferred}"

  if _is_production_api_base "$preferred"; then
    return 0
  fi

  if _local_api_ready "$preferred"; then
    export APP_API_BASE_URL="$preferred"
    return 0
  fi

  if [[ "$preferred" =~ ^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?/?$ ]]; then
    local port candidate
    for port in 5173 5174 5175 5176 5177 5178; do
      candidate="http://localhost:${port}"
      [[ "$candidate" == "$preferred" ]] && continue
      if _local_api_ready "$candidate"; then
        echo "Local API at $preferred failed; using $candidate instead." >&2
        echo "Tip: stop stale dev servers (lsof -i :5173) or set APP_API_BASE_URL=$candidate in .env.local" >&2
        export APP_API_BASE_URL="$candidate"
        return 0
      fi
    done
  fi

  cat >&2 <<EOF
Local LexiLand API is not reachable at $preferred.

Import scripts call your local dev server for AI steps (complete-word, memory-tips, etc.).
Start it with: npm run dev

If Vite picked another port because 5173 is busy, set in .env.local:
  APP_API_BASE_URL=http://localhost:5174

Or stop stale processes on 5173: lsof -i :5173
EOF
  return 1
}

_args_include_dry_run() {
  for arg in "$@"; do
    if [[ "$arg" == "--dry-run" ]]; then
      return 0
    fi
  done
  return 1
}

_production_bulk_api_allowed() {
  local value="${ALLOW_PRODUCTION_BULK_API:-}"
  case "$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

_production_bulk_api_blocked() {
  local url="$1"
  _is_production_api_base "$url" && ! _production_bulk_api_allowed
}

_is_production_api_base() {
  local url="${1%/}"
  local host
  host="$(_api_hostname "$url")"

  case "$host" in
    localhost|127.0.0.1|::1|0.0.0.0|'')
      return 1
      ;;
    learn.lexiland.cc|www.learn.lexiland.cc)
      return 0
      ;;
  esac

  [[ "$host" == *.vercel.app ]]
}

_is_local_api_host() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    localhost|127.0.0.1|::1|0.0.0.0|'')
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

_api_hostname() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse

print((urlparse(sys.argv[1]).hostname or "").lower())
PY
}

_local_api_ready() {
  local base="$1"
  local response http_code

  response="$(
    curl -sS -m 20 -X POST "${base}/api/complete-word" \
      -H 'Content-Type: application/json' \
      -d '{"term":"ping","locale":"zh-Hant"}' \
      -w $'\n__HTTP__%{http_code}' 2>/dev/null
  )" || return 1

  http_code="${response##*__HTTP__}"
  response="${response%$'\n'__HTTP__*}"

  [[ "$http_code" == "200" ]] && [[ "$response" != *'"error":"fetch failed"'* ]]
}
