#!/usr/bin/env python3
"""Enrich a HK word group list into wordbase with AI memory tips and images."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
WORDBASE_IMPORT_DIR = REPO_ROOT / "scripts" / "wordbase_import"
sys.path.insert(0, str(WORDBASE_IMPORT_DIR))
sys.path.insert(0, str(SCRIPT_DIR))

from api_client import ApiError, LexiLandApiClient  # noqa: E402
from ai_retries import call_ai_step  # noqa: E402
from auth import _load_session  # noqa: E402
from completeness import has_memory_image, has_memory_tips, missing_detail_fields, missing_parts  # noqa: E402
from config import load_settings  # noqa: E402
from production_guard import assert_production_bulk_run_allowed  # noqa: E402
from terms import normalize_term  # noqa: E402
from wordbase_client import (  # noqa: E402
    fetch_entry,
    upsert_details,
    upsert_memory_image,
    upsert_memory_tips,
)

DEFAULT_WORD_LIST = REPO_ROOT / "data/hk_word_groups/primary/p1/english.json"
TAXONOMY_PATH = REPO_ROOT / "data/hk_word_groups/taxonomy.json"
PROGRESS_DIR = SCRIPT_DIR / "progress"
IGNORED_DETAIL_FIELDS = {"pronunciation", "part_of_speech"}


def missing_enrich_detail_fields(entry: dict) -> list[str]:
    return [
        field
        for field in missing_detail_fields(entry)
        if field not in IGNORED_DETAIL_FIELDS
    ]


def missing_enrich_parts(entry: dict | None, locale: str) -> list[str]:
    return [
        part
        for part in missing_parts(entry, locale)
        if part not in IGNORED_DETAIL_FIELDS
    ]


def merge_suggestions(*sources: dict) -> dict:
    merged: dict = {"tags": []}
    text_fields = (
        "term",
        "definition",
        "translation",
        "pronunciation",
        "part_of_speech",
        "example",
        "example_translation",
    )

    for source in sources:
        if not source:
            continue
        for field in text_fields:
            value = str(source.get(field, "")).strip()
            if value:
                merged[field] = value
        merged["tags"] = merge_unique_tags(merged.get("tags") or [], source.get("tags") or [])

    return merged


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Upsert word group list entries into wordbase, map them to the group, "
            "and generate AI memory tips + memory images via LexiLand APIs."
        ),
    )
    parser.add_argument(
        "--file",
        type=Path,
        default=None,
        help="Word list JSON path (default: P1 English when neither --all nor --file is set)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Enrich every word list file listed in taxonomy.json.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without writes or AI calls.")
    parser.add_argument("--limit", type=int, default=0, help="Process only the first N words.")
    parser.add_argument("--term", type=str, default="", help="Process one normalized term only.")
    parser.add_argument("--skip-map", action="store_true", help="Skip wordbase_group_map upsert.")
    parser.add_argument("--skip-tips", action="store_true", help="Skip /api/word-memory-tips.")
    parser.add_argument("--skip-images", action="store_true", help="Skip /api/word-memory-image.")
    parser.add_argument(
        "--resume",
        action="store_true",
        default=True,
        help="Skip words already marked complete in progress (default: true).",
    )
    parser.add_argument(
        "--no-resume",
        dest="resume",
        action="store_false",
        help="Re-process all words, including those already complete.",
    )
    parser.add_argument(
        "--contributor-id",
        type=str,
        default=os.getenv("IMPORT_CONTRIBUTOR_ID", "").strip(),
        help="auth.users id stored as wordbase contributor_id (required for writes).",
    )
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_word_list(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_taxonomy_word_list_files() -> list[Path]:
    taxonomy = load_word_list(TAXONOMY_PATH)
    groups = taxonomy.get("groups") or []
    files: list[Path] = []
    seen: set[str] = set()

    for group in groups:
        relative_path = str(group.get("word_list_file") or "").strip()
        if not relative_path or relative_path in seen:
            continue
        seen.add(relative_path)
        files.append(REPO_ROOT / relative_path)

    if not files:
        raise ValueError("No word_list_file entries found in taxonomy.json.")

    return files


def word_json_to_suggestion(word: dict) -> dict:
    part_of_speech = word.get("part_of_speech") or word.get("partOfSpeech") or ""
    example_translation = word.get("example_translation") or word.get("exampleTranslation") or ""

    return {
        "term": str(word.get("term", "")).strip(),
        "definition": str(word.get("definition", "")).strip(),
        "translation": str(word.get("translation", "")).strip(),
        "pronunciation": str(word.get("pronunciation", "")).strip(),
        "part_of_speech": str(part_of_speech).strip(),
        "example": str(word.get("example", "")).strip(),
        "example_translation": str(example_translation).strip(),
        "tags": [str(tag).strip() for tag in (word.get("tags") or []) if str(tag).strip()],
    }


def load_service_client():
    from supabase import create_client

    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or ""
    service_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
        or ""
    ).strip()

    if not url.strip() or not service_key:
        raise ValueError(
            "Missing Supabase service env. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
        )

    return create_client(url.strip(), service_key)


def resolve_contributor_id(explicit_id: str, settings) -> str:
    if explicit_id.strip():
        return explicit_id.strip()

    session = _load_session(settings.session_path)
    user_id = str((session or {}).get("user_id", "")).strip()
    if user_id:
        return user_id

    email = settings.import_user_email.strip()
    if email:
        client = load_service_client()
        page = 1
        while True:
            response = client.auth.admin.list_users(page=page, per_page=200)
            users = getattr(response, "users", None) or []
            for user in users:
                user_email = str(getattr(user, "email", "") or "").strip().lower()
                if user_email == email.lower():
                    return str(getattr(user, "id", "") or "").strip()
            if len(users) < 200:
                break
            page += 1

    session_hint = settings.session_path
    raise ValueError(
        "Could not resolve contributor id. Set one of:\n"
        "  - IMPORT_CONTRIBUTOR_ID in .env.local\n"
        "  - IMPORT_USER_EMAIL in .env.local (looked up via service role)\n"
        f"  - Sign in once via wordbase import (saves user id to {session_hint})"
    )


def resolve_group_id(client, group_code: str) -> str:
    response = (
        client.table("word_groups")
        .select("id")
        .eq("group_code", group_code)
        .maybe_single()
        .execute()
    )
    row = response.data
    if isinstance(row, list):
        row = row[0] if row else None
    group_id = (row or {}).get("id") if isinstance(row, dict) else None
    if not group_id:
        raise ValueError(f"word_groups row not found for {group_code}. Run npm run word-groups:seed first.")
    return group_id


def upsert_group_map(client, group_id: str, wordbase_id: str, contributor_id: str) -> None:
    payload = {
        "group_id": group_id,
        "wordbase_id": wordbase_id,
        "created_by": contributor_id or None,
    }
    client.table("wordbase_group_map").upsert(payload, on_conflict="wordbase_id,group_id").execute()


def fetch_wordbase_id(client, term: str) -> str:
    term_key = normalize_term(term)
    response = (
        client.table("wordbase")
        .select("id")
        .eq("term_key", term_key)
        .maybe_single()
        .execute()
    )
    row = response.data
    if isinstance(row, list):
        row = row[0] if row else None
    return str((row or {}).get("id") or "")


def merge_unique_tags(*tag_lists: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()

    for tags in tag_lists:
        for tag in tags or []:
            clean_tag = str(tag).strip()
            if not clean_tag or clean_tag in seen:
                continue
            seen.add(clean_tag)
            merged.append(clean_tag)

    return merged


def progress_path(group_code: str) -> Path:
    safe_code = group_code.replace("/", "_")
    return PROGRESS_DIR / f"enrich-{safe_code}.json"


def load_progress(group_code: str) -> dict:
    path = progress_path(group_code)
    if not path.exists():
        return {"group_code": group_code, "terms": {}}
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_progress(group_code: str, progress: dict) -> None:
    PROGRESS_DIR.mkdir(parents=True, exist_ok=True)
    path = progress_path(group_code)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(progress, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def process_word(
    *,
    word: dict,
    locale: str,
    group_id: str,
    contributor_id: str,
    api: LexiLandApiClient,
    client,
    args: argparse.Namespace,
    progress: dict,
) -> None:
    suggestion = word_json_to_suggestion(word)
    term = suggestion["term"]
    term_key = normalize_term(term)
    if not term_key:
        raise ValueError("Word entry is missing a valid term.")

    record = progress.setdefault("terms", {}).setdefault(
        term_key,
        {"status": "pending", "missing": [], "errors": {}, "completed_at": None},
    )

    if args.dry_run:
        print(f"  [{term}] check wordbase")
        print("    dry-run: would fetch existing Wordbase entry")
        if not suggestion.get("definition"):
            print(f"  [{term}] complete-word")
            print("    dry-run: would call /api/complete-word for new Wordbase word")
            print(f"  [{term}] upsert wordbase")
            print("    dry-run: would insert only if the word is missing from Wordbase")
        else:
            print(f"  [{term}] upsert wordbase")
            print("    dry-run: would update Wordbase if details or memory content are missing")
        entry = None
    else:
        existing = fetch_entry(client, term)
        if existing:
            entry = existing
            print(f"  [{term}] exists in wordbase")
            detail_missing = missing_enrich_detail_fields(entry)
            if detail_missing:
                print(f"  [{term}] missing details: {', '.join(detail_missing)}")
                merged = merge_suggestions(suggestion, entry)
                if missing_enrich_detail_fields(merged):
                    print(f"  [{term}] complete-word")
                    completed = api.complete_word(term, locale)
                    merged = merge_suggestions(merged, completed)
                suggestion = {
                    **merged,
                    "term": merged.get("term") or term,
                }
                detail_missing = missing_enrich_detail_fields({**entry, **suggestion})
                if detail_missing:
                    record["status"] = "failed"
                    record["errors"]["details"] = (
                        "Could not fill Wordbase details: " + ", ".join(detail_missing)
                    )
                    print(f"  [{term}] skipped — details still missing: {', '.join(detail_missing)}")
                    return
                print(f"  [{term}] update wordbase")
                upsert_details(client, suggestion, contributor_id, entry)
                entry = fetch_entry(client, suggestion["term"]) or fetch_entry(client, term)
        else:
            print(f"  [{term}] missing from wordbase")
            print(f"  [{term}] complete-word")
            completed = api.complete_word(term, locale)
            suggestion = merge_suggestions(suggestion, completed, {"term": term})
            suggestion["term"] = suggestion.get("term") or term
            detail_missing = missing_enrich_detail_fields(suggestion)
            if detail_missing:
                record["status"] = "failed"
                record["errors"]["details"] = (
                    "Complete-word response missing: " + ", ".join(detail_missing)
                )
                print(f"  [{term}] skipped — AI details missing: {', '.join(detail_missing)}")
                return

            print(f"  [{term}] insert wordbase")
            upsert_details(client, suggestion, contributor_id, None)
            entry = fetch_entry(client, suggestion["term"]) or fetch_entry(client, term)

    if not args.skip_map and not args.dry_run:
        mapped_term = str((entry or {}).get("term") or term).strip()
        wordbase_id = fetch_wordbase_id(client, mapped_term)
        if not wordbase_id:
            raise ApiError("Could not resolve wordbase id after upsert.")
        upsert_group_map(client, group_id, wordbase_id, contributor_id)
        print(f"    mapped to group")

    missing = [] if args.dry_run else missing_enrich_parts(entry, locale)

    if not args.skip_tips and (args.dry_run or "memory_tips" in missing):
        print(f"  [{term}] memory-tips")
        if args.dry_run:
            print("    dry-run: would call /api/word-memory-tips")
        else:
            record["errors"].pop("memory_tips", None)
            try:
                tips = call_ai_step(
                    "memory-tips",
                    lambda: api.memory_tips(entry or suggestion, locale),
                )
                upsert_memory_tips(client, entry or suggestion, locale, tips, contributor_id, entry)
                entry = fetch_entry(client, term)
            except Exception as e:
                print(f"    skipped: AI memory-tips failed — {e}")
                record["errors"]["memory_tips"] = str(e)

    missing = [] if args.dry_run else missing_enrich_parts(entry, locale)

    if not args.skip_images and (args.dry_run or "memory_image" in missing):
        print(f"  [{term}] memory-image")
        if args.dry_run:
            print("    dry-run: would call /api/word-memory-image")
        else:
            record["errors"].pop("memory_image", None)
            try:
                image = call_ai_step(
                    "memory-image",
                    lambda: api.memory_image(entry or suggestion),
                )
                upsert_memory_image(client, entry or suggestion, image, contributor_id, entry)
                entry = fetch_entry(client, term)
            except Exception as e:
                print(f"    skipped: AI memory-image failed — {e}")
                record["errors"]["memory_image"] = str(e)

    if args.dry_run:
        record["status"] = "dry-run"
        return

    missing = missing_enrich_parts(entry, locale)
    record["missing"] = missing
    if not missing:
        record["status"] = "complete"
        record["completed_at"] = utc_now()
        record["errors"] = {}
        print(f"  [{term}] complete")
        return

    record["status"] = "incomplete"
    print(f"  [{term}] incomplete — still missing: {', '.join(missing)}")


def enrich_word_list_file(
    args: argparse.Namespace,
    *,
    file_path: Path,
    settings,
    api: LexiLandApiClient,
    contributor_id: str,
    client,
) -> dict:
    payload = load_word_list(file_path)
    group_code = str(payload.get("group_code", "")).strip().lower()
    locale = str(payload.get("locale", "zh-Hant")).strip() or "zh-Hant"
    words = payload.get("words") or []

    if not group_code:
        raise ValueError(f"Word list JSON must include group_code: {file_path}")
    if not isinstance(words, list) or not words:
        raise ValueError(f"Word list JSON must include a non-empty words array: {file_path}")

    if args.term:
        words = [word for word in words if normalize_term(word.get("term")) == normalize_term(args.term)]
        if not words:
            raise ValueError(f"Term not found in word list: {args.term}")

    if args.limit > 0:
        words = words[: args.limit]

    group_id = "" if args.dry_run else resolve_group_id(client, group_code)
    progress = load_progress(group_code)

    # Skip words already marked complete in progress (both in wordbase and group mapped)
    # In dry-run, show all words; in actual run with --resume (default), skip already complete words
    already_complete = set()
    for word in words:
        term_key = normalize_term(word.get("term"))
        if term_key:
            record = progress.get("terms", {}).get(term_key, {})
            if record.get("status") == "complete":
                already_complete.add(term_key)

    if args.dry_run or not args.resume:
        words_to_process = words
        skipped_count = 0
    else:
        words_to_process = [w for w in words if normalize_term(w.get("term")) not in already_complete]
        skipped_count = len(words) - len(words_to_process)

    print("\nHK word group enrich")
    print(f"  file: {file_path}")
    print(f"  group: {group_code}")
    print(f"  locale: {locale}")
    print(f"  words: {len(words)}")
    if not args.dry_run and skipped_count > 0:
        print(f"  skipped (already complete): {skipped_count}")
    incomplete_count = sum(
        1
        for item in progress.get("terms", {}).values()
        if item.get("status") in ("incomplete", "failed")
    )
    if not args.dry_run and incomplete_count > 0:
        print(f"  incomplete/failed in progress: {incomplete_count}")
    print(f"  to process: {len(words_to_process)}")

    for index, word in enumerate(words_to_process, start=1):
        print(f"[{index}/{len(words_to_process)}]")
        try:
            process_word(
                word=word,
                locale=locale,
                group_id=group_id,
                contributor_id=contributor_id,
                api=api,
                client=client,
                args=args,
                progress=progress,
            )
        except Exception as error:
            term_key = normalize_term(word.get("term"))
            record = progress.setdefault("terms", {}).setdefault(term_key, {})
            record["status"] = "failed"
            record["errors"] = {**record.get("errors", {}), "last": str(error)}
            print(f"  [{word.get('term', '')}] failed: {error}")
        finally:
            if not args.dry_run:
                save_progress(group_code, progress)
                time.sleep(0.2)

    total_complete = sum(1 for item in progress.get("terms", {}).values() if item.get("status") == "complete")
    newly_complete = total_complete - skipped_count if not args.dry_run else 0
    failed_this_run = len(words_to_process) - newly_complete if not args.dry_run else 0

    print("\nEnrich summary")
    print(f"  processed: {len(words_to_process)}")
    print(f"  complete: {total_complete}")
    if not args.dry_run and skipped_count > 0:
        print(f"  newly complete this run: {newly_complete}")
        print(f"  skipped (already done): {skipped_count}")
    if not args.dry_run:
        print(f"  progress: {progress_path(group_code)}")

    return {
        "group_code": group_code,
        "processed": len(words_to_process),
        "complete": total_complete,
        "failed": failed_this_run if not args.dry_run else 0,
    }


def main() -> int:
    args = parse_args()

    if args.all and args.file:
        raise ValueError("Use either --all or --file, not both.")
    if args.all:
        file_paths = load_taxonomy_word_list_files()
    else:
        file_paths = [args.file or DEFAULT_WORD_LIST]

    settings = load_settings()
    if not args.dry_run:
        assert_production_bulk_run_allowed(settings.api_base_url)
    api = LexiLandApiClient(
        settings.api_base_url,
        max_retries=settings.max_retries,
        request_pause_seconds=settings.request_pause_seconds,
        image_request_pause_seconds=settings.image_request_pause_seconds,
    )

    contributor_id = "" if args.dry_run else resolve_contributor_id(args.contributor_id, settings)
    client = None if args.dry_run else load_service_client()

    print("HK word group enrich batch" if args.all else "HK word group enrich")
    print(f"  files: {len(file_paths)}")
    print(f"  api: {settings.api_base_url}")
    print(f"  mode: {'dry-run' if args.dry_run else 'write'}")
    import_key = os.getenv("IMPORT_API_KEY", "").strip()
    session = _load_session(settings.session_path)
    if import_key:
        print(f"  ai auth: import key ({len(import_key)} chars)")
    elif session:
        print(f"  ai auth: saved session ({session.get('email') or 'unknown user'})")
    else:
        print("  ai auth: missing — run npm run setup:import-api-key")
    if not args.dry_run:
        print(f"  contributor: {contributor_id}")

    batch_summary = {
        "files": len(file_paths),
        "processed_words": 0,
        "complete_words": 0,
        "failed_groups": 0,
    }

    try:
        for file_index, file_path in enumerate(file_paths, start=1):
            if args.all:
                print(f"\n=== File {file_index}/{len(file_paths)} ===")
            try:
                result = enrich_word_list_file(
                    args,
                    file_path=file_path,
                    settings=settings,
                    api=api,
                    contributor_id=contributor_id,
                    client=client,
                )
                batch_summary["processed_words"] += result["processed"]
                batch_summary["complete_words"] += result["complete"]
            except Exception as error:
                batch_summary["failed_groups"] += 1
                print(f"File failed ({file_path}): {error}")
    finally:
        api.close()

    if args.all:
        print("\nBatch enrich summary")
        print(f"  files: {batch_summary['files']}")
        print(f"  failed groups: {batch_summary['failed_groups']}")
        print(f"  processed words: {batch_summary['processed_words']}")
        print(f"  complete words: {batch_summary['complete_words']}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        raise SystemExit(130)
    except Exception as error:
        print(f"Enrich failed: {error}", file=sys.stderr)
        raise SystemExit(1)
