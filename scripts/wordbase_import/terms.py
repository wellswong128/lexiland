from __future__ import annotations

import re
from pathlib import Path

WORD_SPLIT_PATTERN = re.compile(r"[\s,;/|]+")


def normalize_term(value: str) -> str:
    return str(value or "").strip().lower()


def normalize_single_word_term(value: str) -> str:
    term = str(value or "").strip().lower()
    term = re.sub(r"[^a-z'-]", "", term)

    if not term or len(term) < 2 or WORD_SPLIT_PATTERN.search(term):
        return ""

    return term


def split_into_single_word_terms(raw_items: list) -> list[str]:
    seen: set[str] = set()
    terms: list[str] = []

    for item in raw_items:
        raw = item if isinstance(item, str) else (item or {}).get("term", "")
        for part in WORD_SPLIT_PATTERN.split(str(raw)):
            term = normalize_single_word_term(part)
            if term and term not in seen:
                seen.add(term)
                terms.append(term)

    return terms


def page_label_from_filename(path: str) -> str:
    stem = Path(path).stem
    return re.sub(r"[-_]+", " ", stem).strip().lower()
