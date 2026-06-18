from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

PROGRESS_VERSION = 1


def empty_progress() -> dict[str, Any]:
    return {
        "version": PROGRESS_VERSION,
        "images": {},
        "terms": {},
    }


def load_progress(path: Path) -> dict[str, Any]:
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
    temp_path = path.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    temp_path.replace(path)


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
