from __future__ import annotations

import re
import unicodedata

CJK_PATTERN = re.compile(
    r"[\u3400-\u9fff\uf900-\ufaff"
    r"\U00020000-\U0002a6df\U0002a700-\U0002b73f"
    r"\U0002b740-\U0002b81f\U0002b820-\U0002ceaf"
    r"\U0002ceb0-\U0002ebef]"
)

EXAM_COMMAND_PREFIXES = {
    "analyse": ["分析"],
    "analyze": ["分析"],
    "assess": ["評估", "評價"],
    "compare": ["比較"],
    "describe": ["描述", "描寫"],
    "discuss": ["討論", "議論"],
    "evaluate": ["評估", "評價"],
    "explain": ["解釋", "說明"],
    "identify": ["指出", "識別", "辨識"],
    "justify": ["論證", "證明"],
}


def contains_chinese(text: str | None) -> bool:
    value = str(text or "").strip()
    if CJK_PATTERN.search(value):
        return True

    return any("CJK" in unicodedata.name(char, "") for char in value)


def is_han_character(char: str) -> bool:
    if len(char) != 1:
        return False
    if CJK_PATTERN.fullmatch(char):
        return True
    return "CJK" in unicodedata.name(char, "")


def count_han_characters(text: str | None) -> int:
    return sum(1 for char in str(text or "") if is_han_character(char))


def term_word_count(term: str | None) -> int:
    return len([part for part in str(term or "").split() if part.strip()])


def has_incomplete_multiword_translation(
    entry: dict,
    *,
    max_han_chars: int = 3,
    min_term_words: int = 3,
) -> bool:
    term = str(entry.get("term", "")).strip()
    translation = str(entry.get("translation", "")).strip()

    if term_word_count(term) < min_term_words:
        return False

    if not translation or not contains_chinese(translation):
        return False

    if has_placeholder_translation(translation):
        return True

    if is_incomplete_exam_phrase_translation(term, translation):
        return True

    return count_han_characters(translation) <= max_han_chars


def looks_like_english_text(text: str | None) -> bool:
    value = str(text or "").strip()
    if not value or contains_chinese(value):
        return False
    return bool(re.search(r"[a-zA-Z]", value))


def has_placeholder_translation(text: str | None) -> bool:
    value = str(text or "").strip()
    if not value:
        return True
    if re.search(r"[*＊]", value):
        return True
    if re.search(r"\bTBD\b", value, re.IGNORECASE):
        return True
    return False


PROGRAMMING_EVALUATE_HINTS = (
    "algorithm",
    "code",
    "database",
    "expression",
    "formula",
    "function",
    "interface",
    "network",
    "program",
    "query",
    "spreadsheet",
    "sql",
    "website",
)


def is_programming_evaluate_phrase(term: str | None) -> bool:
    lower = str(term or "").lower()
    return any(hint in lower for hint in PROGRAMMING_EVALUATE_HINTS)


def is_verb_only_synonym_translation(value: str | None, prefixes: list[str]) -> bool:
    chunks = [chunk.strip() for chunk in re.split(r"[；;/、,，]", str(value or "")) if chunk.strip()]
    if not chunks:
        return True
    return all(chunk in prefixes for chunk in chunks)


def is_incomplete_exam_phrase_translation(term: str | None, translation: str | None) -> bool:
    parts = str(term or "").strip().split()
    if len(parts) < 2:
        return False

    command = parts[0].lower()
    prefixes = EXAM_COMMAND_PREFIXES.get(command)
    if not prefixes:
        return False

    if command == "evaluate" and is_programming_evaluate_phrase(term):
        return False

    value = str(translation or "").strip()
    if not value or has_placeholder_translation(value):
        return True

    if re.search(r"[；;/]", value):
        chunks = [chunk.strip() for chunk in re.split(r"[；;/]", value) if chunk.strip()]
        if chunks and all(len(chunk) <= 3 for chunk in chunks):
            return True

    if value in prefixes or is_verb_only_synonym_translation(value, prefixes):
        return True

    if any(value.startswith(prefix) for prefix in prefixes):
        return False

    if any(prefix in value for prefix in prefixes):
        return False

    return True


def needs_translation_fix(entry: dict) -> bool:
    translation = str(entry.get("translation", "")).strip()
    example_translation = str(entry.get("example_translation", "")).strip()
    term = str(entry.get("term", "")).strip()

    if not translation:
        return True

    if looks_like_english_text(translation):
        return True

    if has_placeholder_translation(translation):
        return True

    if is_incomplete_exam_phrase_translation(term, translation):
        return True

    if example_translation and looks_like_english_text(example_translation):
        return True

    if example_translation and has_placeholder_translation(example_translation):
        return True

    return False
