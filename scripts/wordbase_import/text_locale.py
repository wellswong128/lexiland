from __future__ import annotations

import re

CJK_PATTERN = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")


def contains_chinese(text: str | None) -> bool:
    return bool(CJK_PATTERN.search(str(text or "").strip()))


def looks_like_english_text(text: str | None) -> bool:
    value = str(text or "").strip()
    if not value or contains_chinese(value):
        return False
    return bool(re.search(r"[a-zA-Z]", value))


def needs_translation_fix(entry: dict) -> bool:
    translation = str(entry.get("translation", "")).strip()
    example_translation = str(entry.get("example_translation", "")).strip()

    if not translation:
        return True

    if looks_like_english_text(translation):
        return True

    if example_translation and looks_like_english_text(example_translation):
        return True

    return False
