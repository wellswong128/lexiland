# Bulk Word Import from Images

This guide explains how to use `scripts/wordbase_import/import_words_from_images.py` to import vocabulary from page images into LexiLand Wordbase.

For PDF files, see [bulk_import_pdf.md](./bulk_import_pdf.md).

## What It Does

The script runs in two phases:

1. **Extract** — reads images from a folder, calls LexiLand `/api/extract-words-from-image` to pull English terms from each page, then **checks each term against Wordbase** by `term_key`:
   - **Already exists** in Wordbase → marked `exists_in_wordbase`, skipped (no definition, memory tips, or memory image calls)
   - **Not in Wordbase** → queued for the Complete phase
2. **Complete** — for each queued term (new to Wordbase only):
   - Calls `/api/complete-word` for definition and details
   - Then generates memory tips and memory image

Progress is saved to `scripts/wordbase_import/progress.json`.  
Reports are written to `scripts/wordbase_import/reports/`.

## Bulk import vs web app

| | Bulk import (`import_words_from_images.py`) | Web app (photo scan) |
|---|-----|-----|
| Extract API | `/api/extract-words-from-image` | Same endpoint |
| Wordbase check at extract | **Yes** — skips terms that **exist** in Wordbase (`exists_in_wordbase`) | **No** — all detected terms are shown |
| Dedup at extract | Against Wordbase `term_key` | Against the user's **personal word list** only |
| Goal | Fill shared Wordbase efficiently | Let users pick words to save |

The Wordbase lookup during extract runs **only in the Python bulk import script**, after the shared extract API returns. The API and web UI never filter terms by Wordbase at extract time.

## Setup

### 1. Install dependencies

Use the wrapper script (recommended):

```bash
./scripts/wordbase_import/run.sh --help
```

`run.sh` creates a local `.venv` under `scripts/wordbase_import/` and installs `requirements.txt`.

### 2. Environment variables

Configure these in the project root `.env` or `.env.local`:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase URL (required) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (required) |
| `IMPORT_USER_EMAIL` | Import account email |
| `IMPORT_USER_PASSWORD` | Password (optional; can enter at runtime) |
| `IMPORT_API_KEY` | LexiLand API key for extract/complete endpoints |
| `IMAGE_DIR` | Default image folder (optional) |
| `APP_API_BASE_URL` | API base URL (default: `http://localhost:5173` — run `npm run dev` first) |
| `ALLOW_PRODUCTION_BULK_API` | Set to `1` to allow bulk scripts against production (not recommended; burns Vercel quota) |
| `IMPORT_LOCALE` | Locale for memory tips (default: `zh-Hant`) |

### Local API (recommended for bulk import)

Bulk import/enrich calls `/api/complete-word`, `/api/word-memory-tips`, and `/api/word-memory-image`. Run the API locally so you do not burn Vercel quota:

```bash
# Check what API target your env resolves to
npm run wordbase:check-api

# Terminal 1 — local API (reads .env.local, including IMPORT_API_KEY)
npm run dev

# Terminal 2 — generate key once if missing
npm run setup:import-api-key

# Run import against localhost (default APP_API_BASE_URL)
APP_API_BASE_URL=http://localhost:5173 ./scripts/wordbase_import/run.sh --resume
```

All bulk wrapper scripts (`run.sh`, `run-pdf.sh`, `run-enrich-memory.sh`, `run-coca-terms.sh`, `word-groups:enrich`, etc.) now **refuse production API targets** unless you explicitly set `ALLOW_PRODUCTION_BULK_API=1`. Remove `APP_API_BASE_URL=https://learn.lexiland.cc` from `.env.local` if it was set there by mistake.

If you change `IMPORT_API_KEY` in `.env.local`, restart `npm run dev` before resuming imports.

Optional tuning:

| Variable | Default | Purpose |
|----------|---------|---------|
| `IMPORT_MAX_ROUNDS` | `20` | Max completion rounds (`0` = unlimited) |
| `IMPORT_MAX_TERM_ATTEMPTS` | `50` | Max attempts per term |
| `IMPORT_ROUND_PAUSE_SECONDS` | `60` | Pause between rounds |
| `IMPORT_REQUEST_PAUSE_SECONDS` | `1` | Pause between API calls |
| `IMPORT_IMAGE_PAUSE_SECONDS` | `2.5` | Pause between image extract calls |

## Image Folder

Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` (case-insensitive).

Example folder for English reading comprehension pages:

```
/Users/mac/racer/book/eng_reading_comprehension/
```

This folder contains 79 `.JPG` files (`IMG_8632.JPG` onward).

## Basic Usage

Dry run skips Wordbase lookups during extract (all extracted terms are queued). Use a real run (without `--dry-run`) to filter against Wordbase at extract time.

### Dry run (no database writes)

```bash
cd /Users/mac/racer/projects/lexiland

./scripts/wordbase_import/run.sh \
  --dry-run \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension" \
  --limit-images 1
```

### Full import (all images)

```bash
cd /Users/mac/racer/projects/lexiland

./scripts/wordbase_import/run.sh \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension"
```

On first run, the script prompts for Supabase login. The session is saved to `~/.lexiland/import-session.json`.

### Resume after interruption

```bash
./scripts/wordbase_import/run.sh \
  --resume \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension"
```

`--resume` reuses `progress.json` and skips images already extracted successfully.

## Common Options

| Flag | Description |
|------|-------------|
| `--image-dir PATH` | Folder containing page images |
| `--dry-run` | Simulate only; do not write to Supabase |
| `--resume` | Continue from saved progress |
| `--login` | Force a new Supabase login |
| `--limit-images N` | Process only the first N images |
| `--term word` | Process only one normalized term |
| `--max-rounds N` | Max completion rounds (default: 20; `0` = unlimited) |
| `--max-term-attempts N` | Max attempts per term (default: 50) |
| `--round-pause SECONDS` | Pause between rounds (default: 60) |
| `--skip-wordbase-extract-check` | Bulk import only: queue every extracted term even if already complete in Wordbase |
| `--progress-file PATH` | Separate progress JSON (required for parallel imports) |
| `--report-dir PATH` | Separate report directory (recommended for parallel imports) |

## Running two imports in parallel

Do **not** share the default `progress.json` between imports. Two processes writing the same file caused the error:

`progress.tmp -> progress.json: No such file or directory`

Give each import its own progress and report paths:

```bash
# Terminal 1 — first half of images
./scripts/wordbase_import/run.sh \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension" \
  --progress-file scripts/wordbase_import/progress-batch-a.json \
  --report-dir scripts/wordbase_import/reports/batch-a

# Terminal 2 — second half (different folder or --limit-images split)
./scripts/wordbase_import/run.sh \
  --image-dir "/Users/mac/racer/book/other_pages" \
  --progress-file scripts/wordbase_import/progress-batch-b.json \
  --report-dir scripts/wordbase_import/reports/batch-b
```

Or set env vars: `IMPORT_PROGRESS_PATH`, `IMPORT_REPORT_DIR`.

Progress saves now use a file lock and per-process temp files, but **separate progress files are still required** so each import tracks its own terms correctly.

**Session sharing:** All imports use the same Supabase session file (`~/.lexiland/import-session.json` by default). Supabase refresh tokens are single-use, so parallel imports can hit `Invalid Refresh Token: Already Used` if each process refreshes independently. The import script now serializes session reads/writes with a file lock and reloads the latest tokens before each Wordbase upsert. For best results, either run **one import at a time** during the Complete phase, or keep parallel Extract-only batches and merge completion into a single process afterward.

If you see a refresh-token error, re-login once and resume:

```bash
./scripts/wordbase_import/run.sh --login --resume --progress-file scripts/wordbase_import/progress-batch-b.json
```

## Recommended Workflow

1. Confirm `.env.local` has Supabase and `IMPORT_API_KEY` values.
2. Dry-run 1 image to verify extract works.
3. Dry-run 2–3 images if needed.
4. Run the full import on all 79 images.
5. If interrupted, rerun with `--resume`.

Example staged run:

```bash
# Step 1: test one image
./scripts/wordbase_import/run.sh \
  --dry-run \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension" \
  --limit-images 1

# Step 2: test three images for real
./scripts/wordbase_import/run.sh \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension" \
  --limit-images 3

# Step 3: full import
./scripts/wordbase_import/run.sh \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension"
```

Process a single term only:

```bash
./scripts/wordbase_import/run.sh \
  --term apple \
  --resume \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension"
```

Force re-login and continue:

```bash
./scripts/wordbase_import/run.sh \
  --login \
  --resume \
  --image-dir "/Users/mac/racer/book/eng_reading_comprehension"
```

## Output Files

| Path | Description |
|------|-------------|
| `scripts/wordbase_import/progress.json` | Saved extraction/completion progress |
| `scripts/wordbase_import/reports/import-report-*.md` | Summary report after each run |
| `~/.lexiland/import-session.json` | Supabase login session |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (or dry-run finished) |
| `1` | Some terms still incomplete, or fatal error |
| `2` | Authentication error |
| `130` | Interrupted (`Ctrl+C`; progress is saved) |

## Notes

- 79 images will take a long time because each term may require multiple API calls (complete-word, memory tips, memory image).
- Start with `--limit-images 1` before running the full batch.
- If Supabase requests fail with proxy errors, check `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`.
