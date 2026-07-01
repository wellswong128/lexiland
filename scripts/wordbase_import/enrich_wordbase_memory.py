#!/usr/bin/env python3
"""Fill missing memory tips and memory images for existing wordbase rows."""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from api_client import ApiError, LexiLandApiClient
from ai_retries import call_ai_step
from auth import AuthError, ImportAuth
from completeness import (
    map_wordbase_row,
    missing_memory_parts,
)
from config import load_settings
from terms import normalize_term
from wordbase_client import (
    fetch_entry,
    upsert_memory_image,
    upsert_memory_tips,
    WORDBASE_COLUMNS,
)

try:
    import httpx
except Exception:  # pragma: no cover - optional at import time
    httpx = None

DEFAULT_PROGRESS_PATH = SCRIPT_DIR / "progress-enrich-memory.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate memory tips and images for wordbase rows that are missing them.",
    )
    parser.add_argument("--dry-run", action="store_true", help="List affected rows without writing.")
    parser.add_argument("--login", action="store_true", help="Force a new Supabase OTP login.")
    parser.add_argument(
        "--term",
        action="append",
        default=[],
        help="Process one term (repeatable). Matched by normalized term_key.",
    )
    parser.add_argument(
        "--terms",
        type=str,
        default="",
        help="Comma- or newline-separated terms to process.",
    )
    parser.add_argument(
        "--locale",
        type=str,
        default="",
        help="Vocabulary locale for memory tips (default: IMPORT_LOCALE or zh-Hant).",
    )
    parser.add_argument(
        "--group-code",
        type=str,
        default="",
        help="Only enrich words mapped to this HK word group (e.g. hk-secondary-s6-biology).",
    )
    parser.add_argument("--limit", type=int, default=0, help="Process at most N affected rows.")
    parser.add_argument("--tips-only", action="store_true", help="Only fill memory tips.")
    parser.add_argument("--images-only", action="store_true", help="Only fill memory images.")
    parser.add_argument(
        "--progress-file",
        type=Path,
        default=DEFAULT_PROGRESS_PATH,
        help="Progress JSON for resume (default: progress-enrich-memory.json).",
    )
    parser.add_argument(
        "--no-resume",
        action="store_true",
        help="Process all matching rows, ignoring progress file completions.",
    )
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def resolve_target_term_keys(args: argparse.Namespace) -> list[str]:
    raw_terms: list[str] = []

    for term in args.term or []:
        value = str(term or "").strip()
        if value:
            raw_terms.append(value)

    if args.terms:
        for part in str(args.terms).replace("\n", ",").split(","):
            value = part.strip()
            if value:
                raw_terms.append(value)

    term_keys: list[str] = []
    seen: set[str] = set()

    for term in raw_terms:
        term_key = normalize_term(term)
        if term_key and term_key not in seen:
            seen.add(term_key)
            term_keys.append(term_key)

    return term_keys


def should_skip_for_progress(
    record: dict,
    entry: dict,
    locale: str,
    args: argparse.Namespace,
) -> bool:
    if args.no_resume or record.get("status") != "complete":
        return False

    if resolve_target_term_keys(args):
        missing = missing_memory_parts(entry, locale)
        if args.tips_only:
            missing = [part for part in missing if part == "memory_tips"]
        elif args.images_only:
            missing = [part for part in missing if part == "memory_image"]
        return not missing

    return True


def load_progress(path: Path) -> dict:
    if not path.exists():
        return {"terms": {}}
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_progress(path: Path, progress: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(progress, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


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


def fetch_group_wordbase_ids(client, group_code: str) -> list[str]:
    normalized_code = str(group_code or "").strip().lower()
    if not normalized_code:
        return []

    group_response = (
        client.table("word_groups")
        .select("id")
        .eq("group_code", normalized_code)
        .maybe_single()
        .execute()
    )
    group_row = group_response.data
    if isinstance(group_row, list):
        group_row = group_row[0] if group_row else None
    group_id = str((group_row or {}).get("id") or "").strip()
    if not group_id:
        raise ValueError(f"Word group not found: {group_code}")

    mapping_response = (
        client.table("wordbase_group_map")
        .select("wordbase_id")
        .eq("group_id", group_id)
        .execute()
    )
    return sorted(
        {
            str(row.get("wordbase_id") or "").strip()
            for row in (mapping_response.data or [])
            if str(row.get("wordbase_id") or "").strip()
        }
    )


def fetch_wordbase_rows_by_ids(client, wordbase_ids: list[str]) -> list[dict]:
    rows: list[dict] = []
    batch_size = 80

    for index in range(0, len(wordbase_ids), batch_size):
        batch = wordbase_ids[index : index + batch_size]
        response = client.table("wordbase").select(WORDBASE_COLUMNS).in_("id", batch).execute()
        rows.extend(response.data or [])

    return rows


def row_needs_enrich(
    row: dict,
    locale: str,
    *,
    tips_only: bool,
    images_only: bool,
) -> bool:
    if not str(row.get("definition", "")).strip():
        return False

    entry = map_wordbase_row(row)
    missing = missing_memory_parts(entry, locale)
    if not missing:
        return False

    if tips_only:
        return "memory_tips" in missing
    if images_only:
        return "memory_image" in missing
    return bool(missing)


def list_wordbase_rows(client, args: argparse.Namespace, locale: str) -> list[dict]:
    term_keys = resolve_target_term_keys(args)

    if args.group_code:
        wordbase_ids = fetch_group_wordbase_ids(client, args.group_code)
        rows = fetch_wordbase_rows_by_ids(client, wordbase_ids)
        if term_keys:
            allowed = set(term_keys)
            rows = [
                row
                for row in rows
                if normalize_term(row.get("term_key") or row.get("term")) in allowed
            ]
    elif term_keys:
        response = (
            client.table("wordbase")
            .select(WORDBASE_COLUMNS)
            .in_("term_key", term_keys)
            .execute()
        )
        rows = response.data or []
        found_keys = {
            normalize_term(row.get("term_key") or row.get("term"))
            for row in rows
        }
        for term_key in term_keys:
            if term_key not in found_keys:
                print(f"  warning: no wordbase row for term_key={term_key!r}")
    else:
        rows = []
        start = 0
        page_size = 1000

        while True:
            response = (
                client.table("wordbase")
                .select(WORDBASE_COLUMNS)
                .range(start, start + page_size - 1)
                .execute()
            )
            batch = response.data or []
            rows.extend(batch)
            if len(batch) < page_size:
                break
            start += page_size

    filtered = [
        row
        for row in rows
        if row_needs_enrich(
            row,
            locale,
            tips_only=args.tips_only,
            images_only=args.images_only,
        )
    ]
    return filtered


def entry_to_word_context(entry: dict) -> dict:
    return {
        "term": entry["term"],
        "definition": entry.get("definition", ""),
        "translation": entry.get("translation", ""),
        "pronunciation": entry.get("pronunciation", ""),
        "part_of_speech": entry.get("part_of_speech", ""),
        "example": entry.get("example", ""),
        "tags": entry.get("tags") or [],
    }


def enrich_row(
    *,
    api: LexiLandApiClient,
    client,
    contributor_id: str,
    row: dict,
    locale: str,
    args: argparse.Namespace,
    progress: dict,
) -> None:
    entry = map_wordbase_row(row)
    if not entry:
        return

    term = str(entry.get("term") or "").strip()
    term_key = normalize_term(term)
    if not term_key:
        return

    record = progress.setdefault("terms", {}).setdefault(
        term_key,
        {"status": "pending", "missing": [], "errors": {}, "completed_at": None},
    )

    if should_skip_for_progress(record, entry, locale, args):
        print(f"  [{term}] skipped (already complete in progress)")
        return

    missing = missing_memory_parts(entry, locale)
    if args.tips_only:
        missing = [part for part in missing if part == "memory_tips"]
    elif args.images_only:
        missing = [part for part in missing if part == "memory_image"]

    if not missing:
        record["status"] = "complete"
        record["missing"] = []
        record["completed_at"] = record.get("completed_at") or utc_now()
        print(f"  [{term}] already complete")
        return

    record["missing"] = missing
    word_context = entry_to_word_context(entry)

    print(f"  [{term}] missing: {', '.join(missing)}")

    if args.dry_run:
        if "memory_tips" in missing:
            print("    dry-run: would call /api/word-memory-tips")
        if "memory_image" in missing:
            print("    dry-run: would call /api/word-memory-image")
        return

    if "memory_tips" in missing:
        record["errors"].pop("memory_tips", None)
        try:
            tips = call_ai_step(
                "memory-tips",
                lambda: api.memory_tips(word_context, locale),
            )
            upsert_memory_tips(client, word_context, locale, tips, contributor_id, entry)
            entry = fetch_entry(client, term) or entry
            word_context = entry_to_word_context(entry)
        except Exception as error:
            record["errors"]["memory_tips"] = str(error)
            print(f"    memory-tips failed: {error}")
            record["status"] = "incomplete"
            record["missing"] = missing_memory_parts(entry, locale)
            return

    missing = missing_memory_parts(entry, locale)
    if args.tips_only:
        missing = [part for part in missing if part == "memory_tips"]
    elif args.images_only:
        missing = [part for part in missing if part == "memory_image"]

    if "memory_image" in missing:
        record["errors"].pop("memory_image", None)
        try:
            image = call_ai_step(
                "memory-image",
                lambda: api.memory_image(word_context),
            )
            upsert_memory_image(client, word_context, image, contributor_id, entry)
            entry = fetch_entry(client, term) or entry
        except Exception as error:
            record["errors"]["memory_image"] = str(error)
            print(f"    memory-image failed: {error}")
            record["status"] = "incomplete"
            record["missing"] = missing_memory_parts(entry, locale)
            return

    missing = missing_memory_parts(entry, locale)
    if args.tips_only:
        missing = [part for part in missing if part == "memory_tips"]
    elif args.images_only:
        missing = [part for part in missing if part == "memory_image"]

    record["missing"] = missing
    if not missing:
        record["status"] = "complete"
        record["completed_at"] = utc_now()
        record["errors"] = {}
        print(f"  [{term}] complete")
    else:
        record["status"] = "incomplete"
        print(f"  [{term}] still missing: {', '.join(missing)}")


def main() -> int:
    args = parse_args()
    if args.tips_only and args.images_only:
        print("Use only one of --tips-only or --images-only.", file=sys.stderr)
        return 1

    settings = load_settings()
    locale = args.locale or settings.locale
    progress = load_progress(args.progress_file)

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
        rows = list_wordbase_rows(client, args, locale)
        if args.limit > 0:
            rows = rows[: args.limit]

        print("Wordbase memory enrich")
        print(f"  api: {settings.api_base_url}")
        print(f"  locale: {locale}")
        if args.group_code:
            print(f"  group: {args.group_code}")
        target_term_keys = resolve_target_term_keys(args)
        if target_term_keys:
            print(f"  terms: {', '.join(target_term_keys)}")
        print(f"  mode: {'dry-run' if args.dry_run else 'write'}")
        print(f"  to process: {len(rows)}")
        print(f"  progress: {args.progress_file}")

        for index, row in enumerate(rows, start=1):
            print(f"[{index}/{len(rows)}]")
            try:
                enrich_row(
                    api=api,
                    client=client,
                    contributor_id=contributor_id,
                    row=row,
                    locale=locale,
                    args=args,
                    progress=progress,
                )
            except Exception as error:
                term_key = normalize_term(row.get("term"))
                record = progress.setdefault("terms", {}).setdefault(term_key, {})
                record["status"] = "failed"
                record["errors"] = {**record.get("errors", {}), "last": str(error)}
                print(f"  [{row.get('term', '')}] failed: {error}")
            finally:
                if not args.dry_run:
                    save_progress(args.progress_file, progress)
                    time.sleep(0.2)

        complete_count = sum(
            1 for item in progress.get("terms", {}).values() if item.get("status") == "complete"
        )
        print("\nEnrich summary")
        print(f"  processed: {len(rows)}")
        print(f"  complete in progress: {complete_count}")
    except Exception as error:
        print(f"Run failed: {error}", file=sys.stderr)
        print_proxy_hint(error)
        return 1
    finally:
        api.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
