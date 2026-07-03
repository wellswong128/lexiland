#!/usr/bin/env python3
"""Bulk Wordbase import from local PDF files (CLI only).

Renders each PDF page to an image and reuses the same extract/complete pipeline as
import_words_from_images.py. Wordbase existence filtering at extract time happens ONLY
in filter_terms_against_wordbase (shared with the image import script).
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from api_client import ApiError, LexiLandApiClient
from auth import AuthError, ImportAuth
from config import DEFAULT_PDF_PROGRESS_PATH, DEFAULT_PDF_REPORT_DIR, load_settings
from production_guard import assert_production_bulk_run_allowed
from import_words_from_images import (
    count_statuses,
    collect_terms_for_processing,
    filter_terms_against_wordbase,
    print_proxy_hint,
    process_term,
    run_completion_rounds,
    write_report,
)
from pdf_utils import (
    count_pdf_pages,
    list_pdf_files,
    normalize_pdf_dir,
    page_cache_matches_dir,
    page_key,
    page_label_from_pdf_page,
    pdf_page_to_data_url,
    require_fitz,
    sync_pdf_dir_progress,
)
from progress_store import (
    ProgressIOError,
    ensure_term_record,
    load_progress,
    save_progress,
    save_progress_best_effort,
)
from terms import normalize_term

try:
    import httpx
except Exception:  # pragma: no cover - optional at import time
    httpx = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import vocabulary from PDF files into LexiLand wordbase until every word is complete.",
    )
    parser.add_argument(
        "--pdf-dir",
        type=Path,
        default=None,
        help="Folder of PDF files (default: PDF_DIR env or /Users/mac/racer/book/dk1w3)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Run without writing to Supabase.")
    parser.add_argument("--resume", action="store_true", help="Reuse progress file and skip finished pages.")
    parser.add_argument(
        "--reset-extract",
        action="store_true",
        help="Clear cached page extraction for PDFs in --pdf-dir and re-extract from page 1.",
    )
    parser.add_argument(
        "--skip-extract",
        action="store_true",
        help="Skip PDF extraction; only run completion for incomplete terms in progress.",
    )
    parser.add_argument("--login", action="store_true", help="Force a new Supabase OTP login.")
    parser.add_argument("--limit-pdfs", type=int, default=0, help="Process only N PDF files.")
    parser.add_argument(
        "--limit-pages",
        type=int,
        default=0,
        help="Process only N pages total across all selected PDFs.",
    )
    parser.add_argument(
        "--page-start",
        type=int,
        default=1,
        help="First page to extract per PDF (1-based, default: 1).",
    )
    parser.add_argument(
        "--page-end",
        type=int,
        default=0,
        help="Last page to extract per PDF (1-based, 0 = last page).",
    )
    parser.add_argument(
        "--pdf-zoom",
        type=float,
        default=None,
        help="Render zoom for PDF pages (default: PDF_RENDER_ZOOM env or 2.0).",
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
        "--skip-wordbase-extract-check",
        action="store_true",
        help="Bulk import only: do not skip terms already complete in Wordbase during extract.",
    )
    parser.add_argument(
        "--progress-file",
        type=Path,
        default=None,
        help="Progress JSON path (default: scripts/wordbase_import/progress-pdf.json).",
    )
    parser.add_argument(
        "--report-dir",
        type=Path,
        default=None,
        help="Report output directory (default: scripts/wordbase_import/reports/pdf/).",
    )
    return parser.parse_args()


def extract_pdfs(
    *,
    api: LexiLandApiClient,
    import_auth: ImportAuth | None,
    locale: str,
    progress: dict,
    pdf_dir: Path,
    pdf_zoom: float,
    limit_pdfs: int,
    limit_pages: int,
    page_start: int,
    page_end: int,
    resume: bool,
    dry_run: bool,
    skip_wordbase_extract_check: bool,
    reset_extract: bool,
    progress_path: Path,
) -> list[str]:
    sync_pdf_dir_progress(progress, pdf_dir, reset_extract=reset_extract)
    save_progress(progress_path, progress)
    normalized_pdf_dir = normalize_pdf_dir(pdf_dir)

    files = list_pdf_files(pdf_dir)
    if limit_pdfs > 0:
        files = files[:limit_pdfs]

    if not files:
        print(f"No PDF files found in {pdf_dir}")
        return sorted(progress.get("terms", {}).keys())

    all_terms: set[str] = set()
    pages_processed = 0
    pages_progress = progress.setdefault("pages", {})

    for pdf_path in files:
        try:
            total_pages = count_pdf_pages(pdf_path)
        except Exception as error:
            print(f"[extract] {pdf_path.name}: could not open PDF ({error})")
            continue

        start_index = max(1, page_start) - 1
        end_index = total_pages if page_end <= 0 else min(total_pages, page_end)
        if start_index >= end_index:
            print(
                f"[extract] {pdf_path.name}: page range {page_start}-{page_end or total_pages} "
                f"is empty (PDF has {total_pages} pages)"
            )
            continue

        print(f"[extract] {pdf_path.name}: pages {start_index + 1}-{end_index} of {total_pages}")

        for page_index in range(start_index, end_index):
            if limit_pages > 0 and pages_processed >= limit_pages:
                break

            key = page_key(pdf_path, page_index)
            page_record = pages_progress.setdefault(
                key,
                {
                    "status": "pending",
                    "pdf_file": pdf_path.name,
                    "page_number": page_index + 1,
                    "page_label": page_label_from_pdf_page(pdf_path, page_index),
                    "terms": [],
                    "error": None,
                },
            )

            cached_extract = (
                page_record.get("extracted_terms") or page_record.get("terms") or []
            )
            can_reuse_extract = (
                resume
                and page_cache_matches_dir(page_record, pdf_dir)
                and page_record.get("status") == "extracted"
                and bool(cached_extract)
            )

            if can_reuse_extract and page_record.get("wordbase_checked"):
                raw_terms = cached_extract
                terms = page_record.get("terms") or []
                skipped_terms = page_record.get("skipped_terms") or []
                print(
                    f"  {key}: reuse {len(raw_terms)} extracted, "
                    f"{len(terms)} to process, {len(skipped_terms)} already in wordbase"
                )
            elif can_reuse_extract:
                raw_terms = cached_extract
                print(f"  {key}: reuse {len(raw_terms)} extracted terms, checking wordbase")
                terms, skipped_terms = filter_terms_against_wordbase(
                    raw_terms=raw_terms,
                    locale=locale,
                    import_auth=import_auth,
                    progress=progress,
                    filename=key,
                    dry_run=dry_run,
                    skip_wordbase_check=skip_wordbase_extract_check,
                )
                page_record["extracted_terms"] = raw_terms
                page_record["terms"] = terms
                page_record["skipped_terms"] = skipped_terms
                page_record["pdf_dir"] = normalized_pdf_dir
                page_record["wordbase_checked"] = (
                    not dry_run and import_auth is not None and not skip_wordbase_extract_check
                )
                print(
                    f"    wordbase: {len(skipped_terms)} already complete, "
                    f"{len(terms)} need processing"
                )
            else:
                print(f"  {key} ({page_record.get('page_label', '')})")
                try:
                    data_url = pdf_page_to_data_url(pdf_path, page_index, zoom=pdf_zoom)
                    raw_terms = api.extract_words(data_url)
                    page_record["status"] = "extracted"
                    page_record["pdf_dir"] = normalized_pdf_dir
                    page_record["error"] = None
                    page_record["extracted_terms"] = raw_terms
                    print(f"    extracted {len(raw_terms)} terms")
                    save_progress(progress_path, progress)
                except Exception as error:
                    page_record["status"] = "extract_failed"
                    page_record["error"] = str(error)
                    print(f"    extract failed: {error}")
                    pages_processed += 1
                    save_progress(progress_path, progress)
                    continue

                terms, skipped_terms = filter_terms_against_wordbase(
                    raw_terms=raw_terms,
                    locale=locale,
                    import_auth=import_auth,
                    progress=progress,
                    filename=key,
                    dry_run=dry_run,
                    skip_wordbase_check=skip_wordbase_extract_check,
                )
                page_record["terms"] = terms
                page_record["skipped_terms"] = skipped_terms
                page_record["wordbase_checked"] = (
                    not dry_run and import_auth is not None and not skip_wordbase_extract_check
                )
                print(
                    f"    wordbase: {len(skipped_terms)} already complete, "
                    f"{len(terms)} need processing"
                )

            for term in terms:
                all_terms.add(term)
                ensure_term_record(progress, term, key)

            pages_processed += 1
            save_progress(progress_path, progress)

        if limit_pages > 0 and pages_processed >= limit_pages:
            break

    return sorted(all_terms)


def main() -> int:
    args = parse_args()
    started = time.time()

    try:
        require_fitz()
    except ImportError as error:
        print(str(error), file=sys.stderr)
        return 1

    settings = load_settings(
        pdf_dir=args.pdf_dir,
        pdf_zoom=args.pdf_zoom,
        max_rounds=args.max_rounds,
        max_term_attempts=args.max_term_attempts,
        round_pause_seconds=args.round_pause,
        progress_path=args.progress_file,
        report_dir=args.report_dir,
        default_progress_path=DEFAULT_PDF_PROGRESS_PATH,
        default_report_dir=DEFAULT_PDF_REPORT_DIR,
    )
    if not args.dry_run:
        assert_production_bulk_run_allowed(settings.api_base_url)

    print(f"PDF dir:       {settings.pdf_dir}")
    print(f"PDF zoom:      {settings.pdf_zoom}")
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

        if not settings.pdf_dir.exists():
            print(f"PDF directory not found: {settings.pdf_dir}", file=sys.stderr)
            return 1

        extracted_terms: list[str] = []
        if args.skip_extract:
            print("[extract] skipped (--skip-extract)")
        else:
            extracted_terms = extract_pdfs(
                api=api,
                import_auth=import_auth,
                locale=settings.locale,
                progress=progress,
                pdf_dir=settings.pdf_dir,
                pdf_zoom=settings.pdf_zoom,
                limit_pdfs=args.limit_pdfs,
                limit_pages=args.limit_pages,
                page_start=args.page_start,
                page_end=args.page_end,
                resume=args.resume or settings.progress_path.exists(),
                dry_run=args.dry_run,
                skip_wordbase_extract_check=args.skip_wordbase_extract_check,
                reset_extract=args.reset_extract,
                progress_path=settings.progress_path,
            )
            save_progress(settings.progress_path, progress)

        terms = collect_terms_for_processing(progress, extracted_terms)

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
        save_progress_best_effort(settings.progress_path, progress)
        return 2
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        if save_progress_best_effort(settings.progress_path, progress):
            print("Progress saved.")
        return 130
    except ProgressIOError as error:
        print(f"Progress error: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        print(f"Fatal error: {error}", file=sys.stderr)
        print_proxy_hint(error)
        save_progress_best_effort(settings.progress_path, progress)
        return 1
    finally:
        api.close()


if __name__ == "__main__":
    raise SystemExit(main())
