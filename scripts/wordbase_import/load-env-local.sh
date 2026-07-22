#!/usr/bin/env bash
# Read key=value pairs from .env.local (last assignment wins, like python-dotenv override).

load_env_local_value() {
  local key="$1"
  local file="${2:-$ROOT/.env.local}"

  if [[ ! -f "$file" ]]; then
    return 1
  fi

  python3 - "$key" "$file" <<'PY'
import re
import sys
from pathlib import Path

key = sys.argv[1]
path = Path(sys.argv[2])
value = ""

for raw_line in path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#"):
        continue
    if line.startswith("export "):
        line = line[7:].strip()
    match = re.match(rf"^{re.escape(key)}=(.*)$", line)
    if not match:
        continue
    candidate = match.group(1).strip()
    if (
        (candidate.startswith('"') and candidate.endswith('"'))
        or (candidate.startswith("'") and candidate.endswith("'"))
    ):
        candidate = candidate[1:-1]
    if candidate:
        value = candidate

if value:
    print(value)
PY
}

normalize_app_api_base_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse

value = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
default = "http://localhost:5173"

if not value:
    print(default)
    raise SystemExit

if "://" not in value:
    if value.startswith("localhost") or value.startswith("127.0.0.1"):
        value = f"http://{value}"
    else:
        print(value.rstrip("/"))
        raise SystemExit

parsed = urlparse(value)
host = (parsed.hostname or "").lower()
if host in {"localhost", "127.0.0.1"} and not parsed.port:
    print(f"{parsed.scheme}://{parsed.hostname}:5173")
else:
    print(value.rstrip("/"))
PY
}

resolve_bulk_api_env() {
  local allow_from_env=""

  if [[ -z "${APP_API_BASE_URL:-}" ]]; then
    APP_API_BASE_URL="$(load_env_local_value APP_API_BASE_URL || true)"
  fi

  APP_API_BASE_URL="$(normalize_app_api_base_url "${APP_API_BASE_URL:-http://localhost:5173}")"
  export APP_API_BASE_URL

  if [[ -z "${ALLOW_PRODUCTION_BULK_API:-}" ]]; then
    allow_from_env="$(load_env_local_value ALLOW_PRODUCTION_BULK_API || true)"
    if [[ -n "$allow_from_env" ]]; then
      export ALLOW_PRODUCTION_BULK_API="$allow_from_env"
    else
      unset ALLOW_PRODUCTION_BULK_API || true
    fi
  fi

  if [[ "$APP_API_BASE_URL" != *learn.lexiland.cc* ]]; then
    unset ALLOW_PRODUCTION_BULK_API || true
  fi
}
