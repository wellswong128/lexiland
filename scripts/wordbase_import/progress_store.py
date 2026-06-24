from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None

PROGRESS_VERSION = 1


class ProgressIOError(OSError):
    """Progress file read/write failed, often due to parallel imports."""


def empty_progress() -> dict[str, Any]:
    return {
        "version": PROGRESS_VERSION,
        "images": {},
        "terms": {},
    }


def _lock_path(path: Path) -> Path:
    return path.with_name(f"{path.name}.lock")


@contextmanager
def _progress_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = _lock_path(path)

    with lock_path.open("a+", encoding="utf-8") as lock_handle:
        if fcntl is not None:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            if fcntl is not None:
                fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


def load_progress(path: Path) -> dict[str, Any]:
    with _progress_lock(path):
        if not path.exists():
            return empty_progress()

        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)

    if not isinstance(data, dict):
        return empty_progress()

    data.setdefault("version", PROGRESS_VERSION)
    data.setdefault("images", {})
    data.setdefault("terms", {})
    return data


def save_progress(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f"{path.name}.{os.getpid()}.{time.time_ns()}.tmp")

    try:
        with _progress_lock(path):
            with temp_path.open("w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=2, ensure_ascii=False)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())

            try:
                temp_path.replace(path)
            except FileNotFoundError as error:
                raise ProgressIOError(
                    f"Could not save progress to {path}. "
                    "If two imports run at once, give each its own --progress-file "
                    f"(or IMPORT_PROGRESS_PATH). Original error: {error}"
                ) from error
            except OSError as error:
                raise ProgressIOError(
                    f"Could not save progress to {path}. "
                    "If two imports run at once, give each its own --progress-file. "
                    f"Original error: {error}"
                ) from error
    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


def ensure_term_record(progress: dict[str, Any], term: str, source_image: str | None = None) -> dict[str, Any]:
    terms = progress.setdefault("terms", {})
    record = terms.setdefault(
        term,
        {
            "status": "pending",
            "missing": [],
            "rounds": 0,
            "attempts": 0,
            "source_images": [],
            "last_errors": {},
        },
    )

    if source_image and source_image not in record["source_images"]:
        record["source_images"].append(source_image)

    return record


def append_round_log(report_dir: Path, payload: dict[str, Any]) -> None:
    report_dir.mkdir(parents=True, exist_ok=True)
    log_path = report_dir / "import-round-log.jsonl"
    payload = {**payload, "logged_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
