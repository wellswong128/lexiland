#!/usr/bin/env bash
# Resolve APP_API_BASE_URL to a local dev server that can run AI import routes.

resolve_local_api_base() {
  local preferred="${APP_API_BASE_URL:-http://localhost:5173}"
  preferred="${preferred%/}"

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
