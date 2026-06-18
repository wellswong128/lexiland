from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import Client

from completeness import map_wordbase_row
from terms import normalize_term

WORDBASE_COLUMNS = (
    "id, contributor_id, term_key, term, definition, translation, pronunciation, "
    "part_of_speech, example, example_translation, notes, tags, source, "
    "memory_tips_by_locale, memory_image, created_at, updated_at"
)


def default_review_fields() -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "review_level": 0,
        "next_review_at": now,
        "last_reviewed_at": None,
        "correct_count": 0,
        "incorrect_count": 0,
        "last_result": None,
        "is_mistake": False,
        "last_mistake_at": None,
        "mistake_count": 0,
    }


def _first_row(response: Any) -> dict[str, Any] | None:
    if response is None:
        return None

    data = getattr(response, "data", None)
    if data is None:
        return None
    if isinstance(data, dict):
        return data
    if isinstance(data, list):
        return data[0] if data else None
    return None


def fetch_entry(client: Client, term: str) -> dict[str, Any] | None:
    term_key = normalize_term(term)
    if not term_key:
        return None

    try:
        response = (
            client.table("wordbase")
            .select(WORDBASE_COLUMNS)
            .eq("term_key", term_key)
            .limit(1)
            .execute()
        )
    except Exception:
        return None

    row = _first_row(response)
    return map_wordbase_row(row) if row else None


def _pick_text(new_value: str, existing_value: str) -> str:
    cleaned = str(new_value or "").strip()
    if cleaned:
        return cleaned
    return str(existing_value or "").strip()


def build_details_row(
    suggestion: dict[str, Any],
    contributor_id: str,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    existing = existing or {}
    tags = suggestion.get("tags") or []
    if not tags:
        tags = existing.get("tags") or []

    return {
        "contributor_id": contributor_id,
        "term_key": normalize_term(suggestion.get("term") or existing.get("term", "")),
        "term": _pick_text(suggestion.get("term"), existing.get("term", "")),
        "definition": _pick_text(suggestion.get("definition"), existing.get("definition", "")),
        "translation": _pick_text(suggestion.get("translation"), existing.get("translation", "")),
        "pronunciation": _pick_text(suggestion.get("pronunciation"), existing.get("pronunciation", "")),
        "part_of_speech": _pick_text(
            suggestion.get("part_of_speech"),
            existing.get("part_of_speech", ""),
        ),
        "example": _pick_text(suggestion.get("example"), existing.get("example", "")),
        "example_translation": _pick_text(
            suggestion.get("example_translation"),
            existing.get("example_translation", ""),
        ),
        "notes": existing.get("notes") or "",
        "tags": [str(tag).strip() for tag in tags if str(tag).strip()],
        "source": "ai",
        "memory_tips_by_locale": existing.get("memory_tips_by_locale") or {},
        "memory_image": existing.get("memory_image"),
    }


def build_context_row(word: dict[str, Any], contributor_id: str, existing: dict[str, Any] | None) -> dict[str, Any]:
    return build_details_row(
        {
            "term": word.get("term"),
            "definition": word.get("definition"),
            "translation": word.get("translation"),
            "pronunciation": word.get("pronunciation"),
            "part_of_speech": word.get("part_of_speech"),
            "example": word.get("example"),
            "example_translation": word.get("example_translation"),
            "tags": word.get("tags") or [],
        },
        contributor_id,
        existing,
    )


def upsert_row(client: Client, row: dict[str, Any]) -> None:
    term_key = row["term_key"]
    response = (
        client.table("wordbase")
        .select("id")
        .eq("term_key", term_key)
        .limit(1)
        .execute()
    )
    existing = _first_row(response)
    existing_id = existing.get("id") if existing else None

    if existing_id:
        client.table("wordbase").update(row).eq("id", existing_id).execute()
        return

    client.table("wordbase").insert({**default_review_fields(), **row}).execute()


def upsert_details(
    client: Client,
    suggestion: dict[str, Any],
    contributor_id: str,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row = build_details_row(suggestion, contributor_id, existing)
    if not row["term_key"] or not row["definition"]:
        raise ValueError("Word details require term and definition.")

    upsert_row(client, row)
    return row


def upsert_memory_tips(
    client: Client,
    word: dict[str, Any],
    locale: str,
    memory_tips: dict[str, Any],
    contributor_id: str,
    existing: dict[str, Any] | None = None,
) -> None:
    if not memory_tips.get("tips"):
        raise ValueError("Memory tips response was empty.")

    existing = existing or fetch_entry(client, word["term"]) or {}
    tips_by_locale = dict(existing.get("memory_tips_by_locale") or {})
    tips_by_locale[locale] = {
        **memory_tips,
        "savedAt": datetime.now(timezone.utc).isoformat(),
    }

    row = build_context_row(word, contributor_id, existing)
    row["memory_tips_by_locale"] = tips_by_locale
    row["memory_image"] = existing.get("memory_image")
    upsert_row(client, row)


def upsert_memory_image(
    client: Client,
    word: dict[str, Any],
    memory_image: dict[str, Any],
    contributor_id: str,
    existing: dict[str, Any] | None = None,
) -> None:
    if not str(memory_image.get("imageUrl", "")).strip():
        raise ValueError("Memory image response was empty.")

    existing = existing or fetch_entry(client, word["term"]) or {}
    row = build_context_row(word, contributor_id, existing)
    row["memory_tips_by_locale"] = existing.get("memory_tips_by_locale") or {}
    row["memory_image"] = {
        **memory_image,
        "savedAt": datetime.now(timezone.utc).isoformat(),
    }
    upsert_row(client, row)
