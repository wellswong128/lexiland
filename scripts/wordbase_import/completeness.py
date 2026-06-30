from __future__ import annotations

from typing import Any

from text_locale import contains_chinese, has_placeholder_translation, is_incomplete_exam_phrase_translation

DETAIL_FIELDS = (
    "definition",
    "translation",
    "pronunciation",
    "part_of_speech",
    "example",
    "example_translation",
    "tags",
)


def map_wordbase_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None

    return {
        "id": row.get("id"),
        "term": row.get("term") or "",
        "definition": row.get("definition") or "",
        "translation": row.get("translation") or "",
        "pronunciation": row.get("pronunciation") or "",
        "part_of_speech": row.get("part_of_speech") or "",
        "example": row.get("example") or "",
        "example_translation": row.get("example_translation") or "",
        "tags": row.get("tags") or [],
        "memory_tips_by_locale": row.get("memory_tips_by_locale") or {},
        "memory_image": row.get("memory_image"),
    }


def has_memory_tips(entry: dict[str, Any] | None, locale: str) -> bool:
    if not entry:
        return False

    tips_payload = (entry.get("memory_tips_by_locale") or {}).get(locale) or {}
    if isinstance(tips_payload, dict) and tips_payload.get("savedAt"):
        tips_payload = {k: v for k, v in tips_payload.items() if k != "savedAt"}

    tips = tips_payload.get("tips") if isinstance(tips_payload, dict) else None
    if not isinstance(tips, list):
        return False

    return any(
        isinstance(tip, dict) and str(tip.get("method", "")).strip() and str(tip.get("content", "")).strip()
        for tip in tips
    )


def has_memory_image(entry: dict[str, Any] | None) -> bool:
    if not entry:
        return False

    image = entry.get("memory_image") or {}
    return bool(str(image.get("imageUrl", "")).strip())


def missing_parts(entry: dict[str, Any] | None, locale: str) -> list[str]:
    entry = entry or {}
    missing: list[str] = []

    if not str(entry.get("definition", "")).strip():
        missing.append("definition")
    if not str(entry.get("translation", "")).strip():
        missing.append("translation")
    elif not contains_chinese(entry.get("translation", "")):
        missing.append("translation")
    elif has_placeholder_translation(entry.get("translation", "")):
        missing.append("translation")
    elif is_incomplete_exam_phrase_translation(entry.get("term", ""), entry.get("translation", "")):
        missing.append("translation")
    if not str(entry.get("pronunciation", "")).strip():
        missing.append("pronunciation")
    if not str(entry.get("part_of_speech", "")).strip():
        missing.append("part_of_speech")
    if not str(entry.get("example", "")).strip():
        missing.append("example")
    if not str(entry.get("example_translation", "")).strip():
        missing.append("example_translation")
    elif not contains_chinese(entry.get("example_translation", "")):
        missing.append("example_translation")
    elif has_placeholder_translation(entry.get("example_translation", "")):
        missing.append("example_translation")

    tags = entry.get("tags") or []
    if not isinstance(tags, list) or not any(str(tag).strip() for tag in tags):
        missing.append("tags")

    if not has_memory_tips(entry, locale):
        missing.append("memory_tips")

    if not has_memory_image(entry):
        missing.append("memory_image")

    return missing


def missing_memory_parts(entry: dict[str, Any] | None, locale: str) -> list[str]:
    entry = entry or {}
    missing: list[str] = []

    if not has_memory_tips(entry, locale):
        missing.append("memory_tips")

    if not has_memory_image(entry):
        missing.append("memory_image")

    return missing


def is_complete(entry: dict[str, Any] | None, locale: str) -> bool:
    return not missing_parts(entry, locale)


def has_wordbase_definition(entry: dict[str, Any] | None) -> bool:
    return bool(str((entry or {}).get("definition", "")).strip())


def wordbase_entry_exists(entry: dict[str, Any] | None) -> bool:
    return entry is not None


def missing_detail_fields(entry: dict[str, Any] | None) -> list[str]:
    entry = entry or {}
    missing: list[str] = []

    for field in DETAIL_FIELDS:
        if field == "tags":
            tags = entry.get("tags") or []
            if not isinstance(tags, list) or not any(str(tag).strip() for tag in tags):
                missing.append("tags")
            continue

        if field in {"translation", "example_translation"}:
            if not str(entry.get(field, "")).strip():
                missing.append(field)
            elif not contains_chinese(entry.get(field, "")):
                missing.append(field)
            elif has_placeholder_translation(entry.get(field, "")):
                missing.append(field)
            elif field == "translation" and is_incomplete_exam_phrase_translation(
                entry.get("term", ""), entry.get(field, "")
            ):
                missing.append(field)
            continue

        if not str(entry.get(field, "")).strip():
            missing.append(field)

    return missing
