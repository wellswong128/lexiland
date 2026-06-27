# Bulk Word Import from PDF Files

This guide explains how to use `scripts/wordbase_import/import_words_from_pdfs.py` to import vocabulary from local PDF files into LexiLand Wordbase.

It mirrors the image bulk import flow in [bulk_import.md](./bulk_import.md):

1. **Extract** — render each PDF page to an image, call `/api/extract-words-from-image`, then skip terms already complete in Wordbase
2. **Complete** — for each new term, call complete-word, memory tips, and memory image

Progress is saved to `scripts/wordbase_import/progress-pdf.json` by default.

## Setup

Use the PDF wrapper script (creates `.venv` and installs dependencies including PyMuPDF):

```bash
./scripts/wordbase_import/run-pdf.sh --help
```

Environment variables are the same as image import (`VITE_SUPABASE_*`, `IMPORT_API_KEY`, `IMPORT_USER_EMAIL`, etc.), plus:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PDF_DIR` | `/Users/mac/racer/book/dk1w3` | Default PDF folder |
| `PDF_RENDER_ZOOM` | `2.0` | Page render zoom (~144 DPI at 2.0) |
| `IMPORT_PROGRESS_PATH` | `progress-pdf.json` | Override default PDF progress file |
| `IMPORT_REPORT_DIR` | `reports/pdf/` | Override default PDF report folder |

## Basic Usage

### Dry run (one page, no database writes)

```bash
cd /Users/mac/racer/projects/lexiland

./scripts/wordbase_import/run-pdf.sh \
  --dry-run \
  --pdf-dir "/Users/mac/racer/book/dk1w3" \
  --limit-pdfs 1 \
  --limit-pages 1
```

### Full import (all PDFs, all pages)

```bash
./scripts/wordbase_import/run-pdf.sh \
  --pdf-dir "/Users/mac/racer/book/dk1w3"
```

### Resume after interruption

```bash
./scripts/wordbase_import/run-pdf.sh \
  --resume \
  --pdf-dir "/Users/mac/racer/book/dk1w3"
```

## Common Options

| Flag | Description |
|------|-------------|
| `--pdf-dir PATH` | Folder containing `.pdf` files |
| `--dry-run` | Simulate only; do not write to Supabase |
| `--resume` | Continue from saved progress |
| `--login` | Force a new Supabase login |
| `--limit-pdfs N` | Process only the first N PDF files |
| `--limit-pages N` | Process only N pages total across selected PDFs |
| `--page-start N` | First page per PDF (1-based, default: 1) |
| `--page-end N` | Last page per PDF (1-based, 0 = last page) |
| `--pdf-zoom FLOAT` | Render zoom for clearer OCR (default: 2.0) |
| `--term word` | Complete only one normalized term |
| `--progress-file PATH` | Separate progress JSON for parallel imports |
| `--report-dir PATH` | Separate report directory |

## Example: skip front matter

If vocabulary starts on page 10:

```bash
./scripts/wordbase_import/run-pdf.sh \
  --pdf-dir "/Users/mac/racer/book/dk1w3" \
  --page-start 10
```

## npm scripts

```bash
npm run wordbase:import:pdf:dry-run
npm run wordbase:import:pdf
```

## Notes

- Large PDFs (e.g. DK 10000 words) can have hundreds of pages. Start with `--limit-pages 1` before a full run.
- Each page is rendered locally with PyMuPDF, then sent to the same extract API used by image import.
- Use a separate `--progress-file` if running multiple PDF imports in parallel (same guidance as image import).
