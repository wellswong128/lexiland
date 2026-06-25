#!/usr/bin/env python3
"""Bulk Wordbase import from page images (CLI only).

Wordbase existence filtering at extract time happens ONLY in this script
(filter_terms_against_wordbase). The web app photo flow uses the same
/api/extract-words-from-image endpoint but does not skip terms based on Wordbase.
"""
from __future__ import annotations

import argparse
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from api_client import ApiError, LexiLandApiClient, image_to_data_url, list_image_files
from auth import AuthError, ImportAuth
from completeness import (
    is_complete,
    missing_detail_fields,
    missing_parts,
)
from config import load_settings
from progress_store import ProgressIOError, append_round_log, ensure_term_record, load_progress, save_progress
from terms import normalize_term, page_label_from_filename
from wordbase_client import (
    fetch_entries,
    fetch_entry,
    fetch_entry_resolved,
    merge_suggestion_into_entry,
    upsert_details,
    upsert_memory_image,
    upsert_memory_tips,
)

try:
    import httpx
except Exception:  # pragma: no cover - optional at import time
    httpx = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import vocabulary page images into LexiLand wordbase until every word is complete.",
    )
    parser.add_argument(
        "--image-dir",
        type=Path,
        default=None,
        help="Folder of page images (default: IMAGE_DIR env or /Users/mac/racer/projects/tempWordImage)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Run without writing to Supabase.")
    parser.add_argument("--resume", action="store_true", help="Reuse progress.json and skip finished extract steps.")
    parser.add_argument("--login", action="store_true", help="Force a new Supabase OTP login.")
    parser.add_argument("--limit-images", type=int, default=0, help="Process only N image files.")
    parser.add_argument("--term", type=str, default="", help="Process only one normalized term.")
    parser.add_argument(
        "--max-rounds",
        type=int,
        default=None,
        help="Maximum completion rounds (default: 20, 0 = unlimited).",
    )
    parser.add_argument("--max-term-attempts", type=int, default=None, help="Maximum attempts per term.")
    parser.add_argument(
        "--round-pause",
        type=float,
        default=None,
        help="Seconds to wait between completion rounds.",
    )
    parser.add_argument(
        "--skip-wordbase-extract-check",
        action="store_true",
        help="Bulk import only: do not skip terms already complete in Wordbase during extract.",
    )
    parser.add_argument(
        "--progress-file",
        type=Path,
        default=None,
        help="Progress JSON path (default: scripts/wordbase_import/progress.json). Use a separate file per parallel import.",
    )
    parser.add_argument(
        "--report-dir",
        type=Path,
        default=None,
        help="Report output directory (default: scripts/wordbase_import/reports/). Use a separate dir per parallel import.",
    )
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mark_term_exists_in_wordbase(record: dict) -> None:
    record["status"] = "complete"
    record["missing"] = []
    record["completed_at"] = record.get("completed_at") or utc_now()
    record["skipped_reason"] = "exists_in_wordbase"
    record["wordbase_exists"] = True


def filter_terms_against_wordbase(
    *,
    raw_terms: list[str],
    locale: str,
    import_auth: ImportAuth | None,
    progress: dict,
    filename: str,
    dry_run: bool,
    skip_wordbase_check: bool,
) -> tuple[list[str], list[str]]:
    if skip_wordbase_check or dry_run or import_auth is None:
        for term in raw_terms:
            ensure_term_record(progress, term, filename)
        return raw_terms, []

    unique_terms: list[str] = []
    seen: set[str] = set()
    for term in raw_terms:
        term_key = normalize_term(term)
        if not term_key or term_key in seen:
            continue
        seen.add(term_key)
        unique_terms.append(term_key)

    entries = import_auth.run(lambda: fetch_entries(import_auth.client, unique_terms))

    terms_to_process: list[str] = []
    skipped_terms: list[str] = []

    for term in unique_terms:
        entry = entries.get(term)
        record = ensure_term_record(progress, term, filename)

        if is_complete(entry, locale):
            mark_term_exists_in_wordbase(record)
            skipped_terms.append(term)
            continue

        record["status"] = "pending"
        record["missing"] = missing_parts(None, locale)
        record.pop("skipped_reason", None)
        record.pop("wordbase_exists", None)

        terms_to_process.append(term)

    return terms_to_process, skipped_terms


def extract_images(
    *,
    api: LexiLandApiClient,
    import_auth: ImportAuth | None,
    locale: str,
    progress: dict,
    image_dir: Path,
    limit_images: int,
    resume: bool,
    dry_run: bool,
    skip_wordbase_extract_check: bool,
) -> list[str]:
    files = list_image_files(image_dir)
    if limit_images > 0:
        files = files[:limit_images]

    if not files:
        print(f"No images found in {image_dir}")
        return sorted(progress.get("terms", {}).keys())

    all_terms: set[str] = set()

    for path in files:
        filename = path.name
        image_record = progress.setdefault("images", {}).setdefault(
            filename,
            {
                "status": "pending",
                "page_label": page_label_from_filename(filename),
                "terms": [],
                "error": None,
            },
        )

        if resume and image_record.get("status") == "extracted" and image_record.get("wordbase_checked"):
            raw_terms = image_record.get("extracted_terms") or image_record.get("terms") or []
            terms = image_record.get("terms") or []
            skipped_terms = image_record.get("skipped_terms") or []
            print(
                f"[extract] {filename}: reuse {len(raw_terms)} extracted, "
                f"{len(terms)} to process, {len(skipped_terms)} already in wordbase"
            )
        else:
            raw_terms: list[str] = []
            if resume and image_record.get("status") == "extracted" and image_record.get("terms"):
                raw_terms = image_record.get("extracted_terms") or image_record.get("terms") or []
                print(f"[extract] {filename}: reuse {len(raw_terms)} extracted terms, checking wordbase")
            else:
                print(f"[extract] {filename} ({image_record.get('page_label', '')})")
                try:
                    data_url = image_to_data_url(path)
                    raw_terms = api.extract_words(data_url)
                    image_record["status"] = "extracted"
                    image_record["error"] = None
                    print(f"  extracted {len(raw_terms)} terms")
                except Exception as error:
                    image_record["status"] = "extract_failed"
                    image_record["error"] = str(error)
                    print(f"  extract failed: {error}")
                    continue

            terms, skipped_terms = filter_terms_against_wordbase(
                raw_terms=raw_terms,
                locale=locale,
                import_auth=import_auth,
                progress=progress,
                filename=filename,
                dry_run=dry_run,
                skip_wordbase_check=skip_wordbase_extract_check,
            )
            image_record["extracted_terms"] = raw_terms
            image_record["terms"] = terms
            image_record["skipped_terms"] = skipped_terms
            image_record["wordbase_checked"] = (
                not dry_run and import_auth is not None and not skip_wordbase_extract_check
            )
            print(
                f"  wordbase: {len(skipped_terms)} already complete, "
                f"{len(terms)} need processing"
            )

        for term in terms:
            all_terms.add(term)
            ensure_term_record(progress, term, filename)

    return sorted(all_terms)


def process_term(
    *,
    term: str,
    locale: str,
    api: LexiLandApiClient,
    import_auth: ImportAuth | None,
    progress: dict,
    dry_run: bool,
    max_term_attempts: int,
) -> dict:
    record = ensure_term_record(progress, term)
    record["attempts"] = int(record.get("attempts", 0)) + 1

    if record["attempts"] > max_term_attempts:
        record["status"] = "incomplete"
        record["last_errors"] = {
            **record.get("last_errors", {}),
            "attempts": "Reached max term attempts.",
        }
        return record

    entry = None
    if not dry_run and import_auth is not None:
        entry = import_auth.run(lambda: fetch_entry(import_auth.client, term))

    missing = missing_parts(entry, locale)

    if not missing:
        record["status"] = "complete"
        record["missing"] = []
        record["completed_at"] = record.get("completed_at") or utc_now()
        return record

    record["missing"] = missing
    record["status"] = "incomplete"

    current_step = "unknown"
    suggestion: dict | None = None

    try:
        detail_fields_missing = missing_detail_fields(entry)
        if detail_fields_missing:
            current_step = "complete"
            if dry_run:
                print(f"  [{term}] complete-word ({', '.join(detail_fields_missing)})")
                print("    dry-run: would call /api/complete-word and upsert details")
            else:
                print(f"  [{term}] complete-word ({', '.join(detail_fields_missing)})")
                suggestion = api.complete_word(term, locale)
                if not suggestion.get("definition"):
                    raise ApiError("Complete-word response missing definition.")
                assert import_auth is not None
                existing = import_auth.run(lambda: fetch_entry(import_auth.client, term))
                contributor_id = import_auth.contributor_id
                import_auth.run(
                    lambda: upsert_details(
                        import_auth.client,
                        suggestion,
                        contributor_id,
                        existing,
                    )
                )
                entry = import_auth.run(
                    lambda: fetch_entry_resolved(
                        import_auth.client,
                        term,
                        alternate_term=suggestion.get("term"),
                    )
                )
                entry = merge_suggestion_into_entry(entry, suggestion)
                if not str((entry or {}).get("definition", "")).strip():
                    raise ApiError("Complete-word upsert did not persist definition.")

        missing = missing_parts(entry, locale)
        if "memory_tips" in missing:
            current_step = "memory_tips"
            word_context = entry or merge_suggestion_into_entry(None, suggestion or {"term": term})
            if not str(word_context.get("definition", "")).strip():
                raise ApiError("Cannot generate memory tips without definition.")
            print(f"  [{term}] memory-tips")
            if dry_run:
                print("    dry-run: would call /api/word-memory-tips and upsert tips")
            else:
                tips = api.memory_tips(word_context, locale)
                if not tips.get("tips"):
                    raise ApiError("Memory tips response was empty.")
                assert import_auth is not None
                contributor_id = import_auth.contributor_id
                import_auth.run(
                    lambda: upsert_memory_tips(
                        import_auth.client,
                        word_context,
                        locale,
                        tips,
                        contributor_id,
                        entry,
                    )
                )
                entry = import_auth.run(
                    lambda: fetch_entry_resolved(
                        import_auth.client,
                        term,
                        alternate_term=word_context.get("term"),
                    )
                ) or word_context

        missing = missing_parts(entry, locale)
        if "memory_image" in missing:
            current_step = "memory_image"
            word_context = entry or merge_suggestion_into_entry(None, suggestion or {"term": term})
            if not str(word_context.get("definition", "")).strip():
                raise ApiError("Cannot generate memory image without definition.")
            print(f"  [{term}] memory-image")
            if dry_run:
                print("    dry-run: would call /api/word-memory-image and upsert image")
            else:
                image = api.memory_image(word_context)
                assert import_auth is not None
                contributor_id = import_auth.contributor_id
                import_auth.run(
                    lambda: upsert_memory_image(
                        import_auth.client,
                        word_context,
                        image,
                        contributor_id,
                        entry,
                    )
                )
                entry = import_auth.run(
                    lambda: fetch_entry_resolved(
                        import_auth.client,
                        term,
                        alternate_term=word_context.get("term"),
                    )
                ) or word_context

    except AuthError as error:
        record["last_errors"] = {**record.get("last_errors", {}), "auth": str(error)}
        raise
    except Exception as error:
        record["last_errors"] = {**record.get("last_errors", {}), current_step: str(error)}
        print(f"    failed ({current_step}): {error}")
        return record

    missing = missing_parts(entry, locale)
    record["missing"] = missing
    if not missing:
        record["status"] = "complete"
        record["completed_at"] = utc_now()
        print(f"  [{term}] complete")
    else:
        record["status"] = "incomplete"
        print(f"  [{term}] still missing: {', '.join(missing)}")

    return record


def count_statuses(progress: dict) -> Counter:
    counts: Counter = Counter()
    for record in progress.get("terms", {}).values():
        counts[record.get("status", "pending")] += 1
    return counts


def write_report(report_dir: Path, progress: dict, *, rounds: int, duration_seconds: float) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_path = report_dir / f"import-report-{stamp}.md"

    terms = progress.get("terms", {})
    complete = [term for term, record in terms.items() if record.get("status") == "complete"]
    incomplete = [
        (term, record)
        for term, record in terms.items()
        if record.get("status") != "complete"
    ]

    lines = [
        "# Wordbase import report",
        "",
        f"- Finished at: {utc_now()}",
        f"- Duration: {duration_seconds:.0f}s",
        f"- Rounds: {rounds}",
        f"- Terms total: {len(terms)}",
        f"- Complete: {len(complete)}",
        f"- Incomplete: {len(incomplete)}",
        "",
    ]

    if incomplete:
        lines.append("## Incomplete terms")
        lines.append("")
        for term, record in sorted(incomplete):
            missing = ", ".join(record.get("missing") or []) or "unknown"
            lines.append(f"- `{term}` → missing: {missing}")
            errors = record.get("last_errors") or {}
            if errors:
                lines.append(f"  - last errors: {errors}")
        lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def run_completion_rounds(
    *,
    terms: list[str],
    settings,
    api: LexiLandApiClient,
    import_auth: ImportAuth | None,
    progress: dict,
    dry_run: bool,
) -> int:
    max_rounds = settings.max_rounds
    round_number = 0

    while True:
        round_number += 1
        if max_rounds > 0 and round_number > max_rounds:
            print(f"Reached max rounds ({max_rounds}).")
            break

        incomplete_terms = [
            term
            for term in terms
            if progress.get("terms", {}).get(term, {}).get("status") != "complete"
        ]

        if not incomplete_terms:
            print("All terms complete.")
            break

        print(f"\n=== Round {round_number}: {len(incomplete_terms)} incomplete terms ===")
        round_started = time.time()

        for term in incomplete_terms:
            record = progress["terms"].get(term, {})
            record["rounds"] = int(record.get("rounds", 0)) + 1
            process_term(
                term=term,
                locale=settings.locale,
                api=api,
                import_auth=import_auth,
                progress=progress,
                dry_run=dry_run,
                max_term_attempts=settings.max_term_attempts,
            )
            save_progress(settings.progress_path, progress)

        append_round_log(
            settings.report_dir,
            {
                "round": round_number,
                "incomplete_before": len(incomplete_terms),
                "status_counts": dict(count_statuses(progress)),
                "duration_seconds": round(time.time() - round_started, 2),
            },
        )

        if dry_run:
            print("Dry-run: stopping after one completion round.")
            break

        incomplete_terms = [
            term
            for term in terms
            if progress.get("terms", {}).get(term, {}).get("status") != "complete"
        ]
        if not incomplete_terms:
            break

        if settings.round_pause_seconds > 0:
            print(f"Waiting {settings.round_pause_seconds:.0f}s before next round ...")
            time.sleep(settings.round_pause_seconds)

    return round_number


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
    started = time.time()

    settings = load_settings(
        image_dir=args.image_dir,
        max_rounds=args.max_rounds,
        max_term_attempts=args.max_term_attempts,
        round_pause_seconds=args.round_pause,
        progress_path=args.progress_file,
        report_dir=args.report_dir,
    )

    print(f"Progress file: {settings.progress_path}")
    print(f"Report dir:    {settings.report_dir}")

    progress = load_progress(settings.progress_path)
    api = LexiLandApiClient(
        settings.api_base_url,
        max_retries=settings.max_retries,
        request_pause_seconds=settings.request_pause_seconds,
        image_request_pause_seconds=settings.image_request_pause_seconds,
    )

    import_auth: ImportAuth | None = None

    try:
        if not args.dry_run:
            import_auth = ImportAuth(
                supabase_url=settings.supabase_url,
                supabase_anon_key=settings.supabase_anon_key,
                session_path=settings.session_path,
                auth_redirect_url=settings.auth_redirect_url,
                import_user_email=settings.import_user_email,
                import_user_password=settings.import_user_password,
                force_login=args.login,
            )
        elif args.login:
            print("Ignoring --login in dry-run mode.")

        if not settings.image_dir.exists():
            print(f"Creating image directory: {settings.image_dir}")
            settings.image_dir.mkdir(parents=True, exist_ok=True)

        terms = extract_images(
            api=api,
            import_auth=import_auth,
            locale=settings.locale,
            progress=progress,
            image_dir=settings.image_dir,
            limit_images=args.limit_images,
            resume=args.resume or settings.progress_path.exists(),
            dry_run=args.dry_run,
            skip_wordbase_extract_check=args.skip_wordbase_extract_check,
        )
        save_progress(settings.progress_path, progress)

        if args.term:
            terms = [args.term.strip().lower()] if args.term.strip() else terms
            ensure_term_record(progress, args.term.strip().lower())

        if not terms:
            print("No terms to process.")
            return 0

        rounds = run_completion_rounds(
            terms=terms,
            settings=settings,
            api=api,
            import_auth=import_auth,
            progress=progress,
            dry_run=args.dry_run,
        )

        save_progress(settings.progress_path, progress)
        report_path = write_report(
            settings.report_dir,
            progress,
            rounds=rounds,
            duration_seconds=time.time() - started,
        )

        counts = count_statuses(progress)
        print("\nSummary")
        print(f"  terms: {sum(counts.values())}")
        for status, count in sorted(counts.items()):
            print(f"  {status}: {count}")
        print(f"  report: {report_path}")

        incomplete_count = counts.get("incomplete", 0) + counts.get("pending", 0)
        return 1 if incomplete_count > 0 and not args.dry_run else 0

    except AuthError as error:
        print(f"Auth error: {error}", file=sys.stderr)
        print_proxy_hint(error)
        return 2
    except KeyboardInterrupt:
        print("\nInterrupted. Progress saved.")
        save_progress(settings.progress_path, progress)
        return 130
    except ProgressIOError as error:
        print(f"Progress error: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        print(f"Fatal error: {error}", file=sys.stderr)
        print_proxy_hint(error)
        save_progress(settings.progress_path, progress)
        return 1
    finally:
        api.close()


if __name__ == "__main__":
    raise SystemExit(main())
