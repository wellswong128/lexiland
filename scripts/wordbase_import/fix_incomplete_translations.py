#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from ai_retries import call_ai_step
from api_client import ApiError, LexiLandApiClient
from auth import AuthError, ImportAuth
from config import load_settings
from production_guard import assert_production_bulk_run_allowed
from text_locale import (
    EXAM_COMMAND_PREFIXES,
    count_han_characters,
    has_incomplete_multiword_translation,
    has_placeholder_translation,
    is_incomplete_exam_phrase_translation,
    term_word_count,
)
from wordbase_client import fetch_entry, upsert_details

try:
    import httpx
except Exception:  # pragma: no cover - optional at import time
    httpx = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Re-generate Chinese translations for wordbase rows where a multi-word English "
            "term has an overly short Chinese translation."
        ),
    )
    parser.add_argument("--dry-run", action="store_true", help="List affected rows without writing.")
    parser.add_argument("--login", action="store_true", help="Force a new Supabase OTP login.")
    parser.add_argument("--term", type=str, default="", help="Fix only one normalized term.")
    parser.add_argument(
        "--locale",
        type=str,
        default="",
        help="Vocabulary locale for AI (default: IMPORT_LOCALE or zh-Hant).",
    )
    parser.add_argument(
        "--max-han-chars",
        type=int,
        default=3,
        help="Flag translations with at most this many Han characters (default: 3).",
    )
    parser.add_argument(
        "--min-term-words",
        type=int,
        default=3,
        help="Only terms with at least this many words (default: 3 = more than 2 words).",
    )
    parser.add_argument(
        "--exam-phrases-only",
        action="store_true",
        help="Only fix terms starting with exam command verbs (evaluate, compare, assess, ...).",
    )
    parser.add_argument("--limit", type=int, default=0, help="Process at most N affected rows.")
    return parser.parse_args()


def row_matches_filters(row: dict, args: argparse.Namespace) -> bool:
    if not has_incomplete_multiword_translation(
        row,
        max_han_chars=args.max_han_chars,
        min_term_words=args.min_term_words,
    ):
        return False

    if not args.exam_phrases_only:
        return True

    first_word = str(row.get("term", "")).strip().split()[0].lower() if row.get("term") else ""
    return first_word in EXAM_COMMAND_PREFIXES


def list_wordbase_rows(client, args: argparse.Namespace) -> list[dict]:
    rows: list[dict] = []
    start = 0
    page_size = 1000

    while True:
        query = client.table("wordbase").select(
            "id, term_key, term, definition, translation, example, example_translation"
        )
        if args.term:
            from terms import normalize_term

            query = query.eq("term_key", normalize_term(args.term))
            response = query.execute()
            rows.extend(response.data or [])
            break

        response = query.range(start, start + page_size - 1).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size

    return [row for row in rows if row_matches_filters(row, args)]


def suggestion_to_wordbase_payload(suggestion: dict) -> dict:
    return {
        "term": suggestion["term"],
        "definition": suggestion["definition"],
        "translation": suggestion["translation"],
        "pronunciation": suggestion["pronunciation"],
        "part_of_speech": suggestion["part_of_speech"],
        "example": suggestion["example"],
        "example_translation": suggestion["example_translation"],
        "tags": suggestion["tags"],
    }


def translation_is_fixed(row: dict, suggestion: dict, args: argparse.Namespace) -> bool:
    translation = str(suggestion.get("translation", "")).strip()
    if has_placeholder_translation(translation):
        return False
    if is_incomplete_exam_phrase_translation(row["term"], translation):
        return False

    candidate = {**row, "translation": translation}
    return not has_incomplete_multiword_translation(
        candidate,
        max_han_chars=args.max_han_chars,
        min_term_words=args.min_term_words,
    )


def print_proxy_hint(error: Exception) -> None:
    message = str(error)
    lower_message = message.lower()
    is_proxy_error = (
        (httpx is not None and isinstance(error, httpx.ProxyError))
        or "proxyerror" in lower_message
        or "proxy" in lower_message
    )

    if not is_proxy_error:
        return

    print(
        (
            "Network proxy blocked Supabase requests. "
            "Please check HTTP_PROXY / HTTPS_PROXY (and NO_PROXY) "
            "or try a direct network."
        ),
        file=sys.stderr,
    )


def fix_wordbase_row(
    api: LexiLandApiClient,
    client,
    contributor_id: str,
    row: dict,
    locale: str,
    args: argparse.Namespace,
) -> None:
    term = row["term"]
    translation = str(row.get("translation", "")).strip()
    print(
        f"[wordbase] {term}: "
        f"words={term_word_count(term)} "
        f"han_chars={count_han_characters(translation)} "
        f"translation={translation!r}"
    )

    if args.dry_run:
        return

    suggestion = call_ai_step(
        "complete-word",
        lambda: api.complete_word(term, locale),
    )
    if not translation_is_fixed(row, suggestion, args):
        raise ApiError(
            f"AI still returned incomplete translation for {term!r}: "
            f"{suggestion.get('translation', '')!r}"
        )

    existing = fetch_entry(client, term)
    if not existing:
        raise ApiError(f"Wordbase row not found for {term!r}")

    payload = suggestion_to_wordbase_payload(suggestion)
    payload["term"] = term
    upsert_details(client, payload, contributor_id, existing)

    updated = fetch_entry(client, term)
    updated_translation = str((updated or {}).get("translation", "")).strip()
    if not translation_is_fixed(row, {"translation": updated_translation}, args):
        raise ApiError(
            f"Update did not persist for {term!r}: translation={updated_translation!r}"
        )

    print(
        f"[wordbase] {term}: updated -> "
        f"han_chars={count_han_characters(updated_translation)} "
        f"translation={updated_translation!r}"
    )


def main() -> int:
    args = parse_args()
    settings = load_settings()
    if not args.dry_run:
        assert_production_bulk_run_allowed(settings.api_base_url)
    locale = args.locale or settings.locale

    try:
        auth = ImportAuth(
            supabase_url=settings.supabase_url,
            supabase_anon_key=settings.supabase_anon_key,
            session_path=settings.session_path,
            auth_redirect_url=settings.auth_redirect_url,
            import_user_email=settings.import_user_email,
            import_user_password=settings.import_user_password,
            force_login=args.login,
        )
    except (AuthError, ValueError) as error:
        print(f"Auth failed: {error}", file=sys.stderr)
        print_proxy_hint(error)
        return 1
    except Exception as error:
        print(f"Auth failed: {error}", file=sys.stderr)
        print_proxy_hint(error)
        return 1

    client = auth.client
    if client is None:
        print("Auth failed: Supabase client is not connected.", file=sys.stderr)
        return 1

    contributor_id = auth.contributor_id
    api = LexiLandApiClient(
        settings.api_base_url,
        max_retries=settings.max_retries,
        request_pause_seconds=settings.request_pause_seconds,
        image_request_pause_seconds=settings.image_request_pause_seconds,
    )

    try:
        wordbase_rows = list_wordbase_rows(client, args)
        if args.limit > 0:
            wordbase_rows = wordbase_rows[: args.limit]

        print(
            f"Found {len(wordbase_rows)} wordbase row(s) with incomplete multi-word translations "
            f"(>= {args.min_term_words} words, <= {args.max_han_chars} Han chars)."
        )

        failed = 0
        for row in wordbase_rows:
            try:
                fix_wordbase_row(api, client, contributor_id, row, locale, args)
            except (ApiError, ValueError) as error:
                failed += 1
                print(f"[wordbase] {row['term']}: failed -> {error}", file=sys.stderr)

        if failed:
            print(f"Finished with {failed} failure(s).", file=sys.stderr)
            return 1
    except Exception as error:
        print(f"Run failed: {error}", file=sys.stderr)
        print_proxy_hint(error)
        return 1
    finally:
        api.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
