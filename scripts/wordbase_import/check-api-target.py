#!/usr/bin/env python3
"""Report which API target bulk scripts would use and whether it is safe."""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from config import load_settings
from production_guard import (
    DEFAULT_LOCAL_API_BASE_URL,
    describe_api_target,
    is_local_api_host,
    is_production_api_base,
    production_bulk_api_allowed,
    warn_if_misconfigured_api_env,
)

try:
    import httpx
except Exception:  # pragma: no cover - optional at import time
    httpx = None


def local_api_ready(base_url: str) -> bool:
    if httpx is None:
        return False
    try:
        response = httpx.post(
            f"{base_url.rstrip('/')}/api/complete-word",
            json={"term": "ping", "locale": "zh-Hant"},
            timeout=20.0,
        )
    except Exception:
        return False
    if response.status_code != 200:
        return False
    return '"error":"fetch failed"' not in response.text


def main() -> int:
    settings = load_settings()
    target = settings.api_base_url
    warnings = warn_if_misconfigured_api_env()

    print("Bulk script API target check")
    print(f"  resolved target: {describe_api_target(target)}")
    print(f"  APP_API_BASE_URL env: {__import__('os').getenv('APP_API_BASE_URL') or '(unset → localhost default)'}")
    print(f"  default fallback: {DEFAULT_LOCAL_API_BASE_URL}")

    if production_bulk_api_allowed():
        print("  ALLOW_PRODUCTION_BULK_API: enabled (production bulk allowed)")
    else:
        print("  ALLOW_PRODUCTION_BULK_API: disabled")

    for warning in warnings:
        print(f"  warning: {warning}")

    if is_production_api_base(target):
        if production_bulk_api_allowed():
            print("  status: production bulk is explicitly allowed")
            return 0
        print("  status: BLOCKED — bulk scripts will refuse production API")
        return 2

    host = urlparse(target).hostname or ""
    if is_local_api_host(host):
        if local_api_ready(target):
            print("  status: OK — local dev API is reachable")
            return 0
        print("  status: local target configured but dev API is not reachable")
        print("  next step: run `npm run dev` in another terminal")
        return 1

    print("  status: non-local, non-production target — proceed with caution")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
