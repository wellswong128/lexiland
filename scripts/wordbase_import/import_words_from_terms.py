#!/usr/bin/env python3
"""Bulk Wordbase import from a plain-text term list (one term per line).

Reuses the same complete-word / memory-tips / memory-image pipeline as
import_words_from_images.py. Use a separate --progress-file per parallel worker.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_COCA_TERMS_DIR = REPO_ROOT / "data" / "coca20000"
DEFAULT_COCA_PROGRESS_DIR = SCRIPT_DIR
DEFAULT_COCA_REPORT_DIR = SCRIPT_DIR / "reports" / "coca"

sys.path.insert(0, str(SCRIPT_DIR))

from auth import AuthError, ImportAuth
from config import load_settings
from production_guard import assert_production_bulk_run_allowed
from import_words_from_images import (
    collect_terms_for_processing,
    count_statuses,
    filter_terms_against_wordbase,
    print_proxy_hint,
    run_completion_rounds,
    write_report,
)
from progress_store import ProgressIOError, ensure_term_record, load_progress, save_progress
from terms import normalize_term

try:
    import httpx
except Exception:  # pragma: no cover - optional at import time
    httpx = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import vocabulary from a text term list into LexiLand wordbase.",
    )
    parser.add_argument(
        "--terms-file",
        type=Path,
        required=True,
        help="Text file with one term per line.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Run without writing to Supabase.")
    parser.add_argument("--resume", action="store_true", help="Reuse progress file and skip finished terms.")
    parser.add_argument("--login", action="store_true", help="Force a new Supabase OTP login.")
    parser.add_argument(
        "--limit-terms",
        type=int,
        default=0,
        help="Process only the first N unique terms from the file.",
    )
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
        "--skip-wordbase-check",
        action="store_true",
        help="Do not skip terms already complete in Wordbase during load.",
    )
    parser.add_argument(
        "--skip-completion",
        action="store_true",
        help="Only load terms into progress; do not call AI completion APIs.",
    )
    parser.add_argument(
        "--progress-file",
        type=Path,
        default=None,
        help="Progress JSON path (required for parallel imports).",
    )
    parser.add_argument(
        "--report-dir",
        type=Path,
        default=None,
        help="Report output directory (use a separate dir per parallel worker).",
    )
    return parser.parse_args()


def load_terms_from_file(path: Path, *, limit: int = 0) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"Terms file not found: {path}")

    terms: list[str] = []
    seen: set[str] = set()

    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue

        term_key = normalize_term(raw)
        if not term_key or term_key in seen:
            continue

        seen.add(term_key)
        terms.append(term_key)

        if limit > 0 and len(terms) >= limit:
            break

    return terms


def register_terms(
    *,
    terms_file: Path,
    locale: str,
    import_auth: ImportAuth | None,
    progress: dict,
    dry_run: bool,
    skip_wordbase_check: bool,
    limit_terms: int,
) -> list[str]:
    raw_terms = load_terms_from_file(terms_file, limit=limit_terms)
    source_label = terms_file.name

    print(f"[terms] {terms_file}: {len(raw_terms)} unique terms")

    terms, skipped_terms = filter_terms_against_wordbase(
        raw_terms=raw_terms,
        locale=locale,
        import_auth=import_auth,
        progress=progress,
        filename=source_label,
        dry_run=dry_run,
        skip_wordbase_check=skip_wordbase_check,
    )

    progress.setdefault("sources", {})[source_label] = {
        "path": str(terms_file),
        "raw_count": len(raw_terms),
        "to_process": len(terms),
        "skipped_complete": len(skipped_terms),
    }

    print(
        f"  wordbase: {len(skipped_terms)} already complete, "
        f"{len(terms)} need processing"
    )

    for term in terms:
        ensure_term_record(progress, term, source_label)

    return sorted(terms)


def main() -> int:
    args = parse_args()
    started = time.time()

    settings = load_settings(
        max_rounds=args.max_rounds,
        max_term_attempts=args.max_term_attempts,
        round_pause_seconds=args.round_pause,
        progress_path=args.progress_file,
        report_dir=args.report_dir,
    )
    if not args.dry_run:
        assert_production_bulk_run_allowed(settings.api_base_url)

    from api_client import LexiLandApiClient

    print(f"Terms file:    {args.terms_file.resolve()}")
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

        terms = register_terms(
            terms_file=args.terms_file,
            locale=settings.locale,
            import_auth=import_auth,
            progress=progress,
            dry_run=args.dry_run,
            skip_wordbase_check=args.skip_wordbase_check,
            limit_terms=args.limit_terms,
        )
        save_progress(settings.progress_path, progress)

        if args.term:
            term_key = normalize_term(args.term)
            if term_key:
                terms = [term_key]
                ensure_term_record(progress, term_key, args.terms_file.name)

        terms = collect_terms_for_processing(progress, terms)

        if not terms:
            print("No terms to process.")
            return 0

        rounds = 0
        if args.skip_completion:
            print("Skipping completion phase (--skip-completion).")
        else:
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
        return 1 if incomplete_count > 0 and not args.dry_run and not args.skip_completion else 0

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
