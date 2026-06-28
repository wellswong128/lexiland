from __future__ import annotations

import time

from api_client import is_transient_ai_error

AI_STEP_ATTEMPTS = 3
AI_STEP_BACKOFF_SECONDS = [0.0, 8.0, 20.0]


def call_ai_step(label: str, fn):
    last_error: Exception | None = None

    for attempt in range(AI_STEP_ATTEMPTS):
        try:
            return fn()
        except Exception as error:
            last_error = error
            status_code = getattr(error, "status_code", None)
            retryable = getattr(error, "retryable", False) or is_transient_ai_error(
                status_code, str(error)
            )
            if not retryable or attempt >= AI_STEP_ATTEMPTS - 1:
                raise
            wait = AI_STEP_BACKOFF_SECONDS[min(attempt + 1, len(AI_STEP_BACKOFF_SECONDS) - 1)]
            print(
                f"    {label} transient failure (attempt {attempt + 1}/{AI_STEP_ATTEMPTS}): "
                f"{error}; retrying in {int(wait)}s...",
                flush=True,
            )
            time.sleep(wait)

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"{label} failed without an error.")
