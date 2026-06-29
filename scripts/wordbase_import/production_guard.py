from __future__ import annotations

import os
from urllib.parse import urlparse

DEFAULT_LOCAL_API_BASE_URL = "http://localhost:5173"

BULK_AI_API_PATHS = frozenset(
    {
        "/api/word-memory-image",
        "/api/word-memory-tips",
        "/api/complete-word",
        "/api/extract-words-from-image",
    }
)

PRODUCTION_API_HOSTS = frozenset(
    {
        "learn.lexiland.cc",
        "www.learn.lexiland.cc",
    }
)

PRODUCTION_API_HOST_SUFFIXES = (".vercel.app",)


def is_local_api_host(hostname: str) -> bool:
    host = (hostname or "").lower().strip().rstrip(".")
    return host in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def is_production_api_base(base_url: str) -> bool:
    parsed = urlparse(base_url.strip())
    host = (parsed.hostname or "").lower()
    if not host or is_local_api_host(host):
        return False
    if host in PRODUCTION_API_HOSTS:
        return True
    return any(host.endswith(suffix) for suffix in PRODUCTION_API_HOST_SUFFIXES)


def is_bulk_ai_api_path(path: str) -> bool:
    normalized = "/" + path.strip().lstrip("/")
    normalized = normalized.split("?", 1)[0]
    return normalized in BULK_AI_API_PATHS


def production_bulk_api_allowed() -> bool:
    value = os.getenv("ALLOW_PRODUCTION_BULK_API", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def assert_bulk_api_allowed(base_url: str, path: str) -> None:
    if not is_bulk_ai_api_path(path) or not is_production_api_base(base_url):
        return
    if production_bulk_api_allowed():
        return

    raise RuntimeError(
        "Refusing bulk AI request to production API "
        f"({base_url.rstrip('/')}{path}). "
        "Bulk enrich/import burns Vercel Fluid Provisioned Memory.\n"
        "Start the local API with `npm run dev`, then run scripts with "
        "APP_API_BASE_URL=http://localhost:5173.\n"
        "To override intentionally, set ALLOW_PRODUCTION_BULK_API=1 "
        "(not recommended)."
    )


def assert_production_bulk_run_allowed(base_url: str) -> None:
    if not is_production_api_base(base_url) or production_bulk_api_allowed():
        return

    raise RuntimeError(
        "Refusing bulk enrich/import against production API "
        f"({base_url.rstrip('/')}). "
        "Start the local API with `npm run dev` and use "
        "APP_API_BASE_URL=http://localhost:5173.\n"
        "To override intentionally, set ALLOW_PRODUCTION_BULK_API=1 "
        "(not recommended)."
    )
