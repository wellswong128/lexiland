#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from api_client import ApiError, LexiLandApiClient
from auth import AuthError, ImportAuth
from config import load_settings
from text_locale import needs_translation_fix
from wordbase_client import fetch_entry, upsert_details

try:
    import httpx
except Exception:  # pragma: no cover - optional at import time
    httpx = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Re-generate Chinese translation fields for wordbase rows (and optionally user words) "
            "that currently contain English text."
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
        "--include-words",
        action="store_true",
        help="Also fix rows in public.words (requires SUPABASE_SERVICE_ROLE_KEY).",
    )
    parser.add_argument("--limit", type=int, default=0, help="Process at most N affected rows.")
    return parser.parse_args()


def list_wordbase_rows(client, term: str = "") -> list[dict]:
    query = client.table("wordbase").select(
        "id, term_key, term, definition, translation, example, example_translation"
    )
    if term:
        from terms import normalize_term

        query = query.eq("term_key", normalize_term(term))

    response = query.execute()
    rows = response.data or []
    return [row for row in rows if needs_translation_fix(row)]


def list_user_word_rows(client, term: str = "") -> list[dict]:
    query = client.table("words").select(
        "id, user_id, term, definition, translation, example, example_translation"
    )
    if term:
        from terms import normalize_term

        query = query.ilike("term", normalize_term(term))

    response = query.execute()
    rows = response.data or []
    return [row for row in rows if needs_translation_fix(row)]


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


def fix_wordbase_row(api: LexiLandApiClient, client, contributor_id: str, row: dict, locale: str, dry_run: bool) -> None:
    term = row["term"]
    print(f"[wordbase] {term}: translation={row.get('translation', '')!r}")

    if dry_run:
        return

    suggestion = api.complete_word(term, locale)
    existing = fetch_entry(client, term)
    upsert_details(client, suggestion_to_wordbase_payload(suggestion), contributor_id, existing)
    print(f"[wordbase] {term}: updated -> {suggestion.get('translation', '')!r}")


def fix_user_word_row(api: LexiLandApiClient, client, row: dict, locale: str, dry_run: bool) -> None:
    term = row["term"]
    print(f"[words] {term} (user={row.get('user_id')}): translation={row.get('translation', '')!r}")

    if dry_run:
        return

    suggestion = api.complete_word(term, locale)
    client.table("words").update(
        {
            "translation": suggestion["translation"],
            "example_translation": suggestion["example_translation"],
            "definition": suggestion["definition"] or row.get("definition", ""),
            "pronunciation": suggestion["pronunciation"] or row.get("pronunciation", ""),
            "part_of_speech": suggestion["part_of_speech"] or row.get("part_of_speech", ""),
            "example": suggestion["example"] or row.get("example", ""),
        }
    ).eq("id", row["id"]).execute()
    print(f"[words] {term}: updated -> {suggestion.get('translation', '')!r}")


def create_service_client(settings):
    import os

    from supabase import create_client

    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not service_role_key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required when --include-words is set.")

    return create_client(settings.supabase_url, service_role_key)


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


def main() -> int:
    args = parse_args()
    settings = load_settings()
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
        wordbase_rows = list_wordbase_rows(client, args.term)
        if args.limit > 0:
            wordbase_rows = wordbase_rows[: args.limit]

        print(f"Found {len(wordbase_rows)} wordbase row(s) needing translation fixes.")

        for row in wordbase_rows:
            try:
                fix_wordbase_row(api, client, contributor_id, row, locale, args.dry_run)
            except (ApiError, ValueError) as error:
                print(f"[wordbase] {row['term']}: failed -> {error}", file=sys.stderr)

        if args.include_words:
            words_client = create_service_client(settings)
            user_word_rows = list_user_word_rows(words_client, args.term)
            if args.limit > 0:
                user_word_rows = user_word_rows[: args.limit]

            print(f"Found {len(user_word_rows)} user word row(s) needing translation fixes.")

            for row in user_word_rows:
                try:
                    fix_user_word_row(api, words_client, row, locale, args.dry_run)
                except (ApiError, ValueError) as error:
                    print(f"[words] {row['term']}: failed -> {error}", file=sys.stderr)
    except Exception as error:
        print(f"Run failed: {error}", file=sys.stderr)
        print_proxy_hint(error)
        return 1
    finally:
        api.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
