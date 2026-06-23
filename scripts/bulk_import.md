# Bulk Word Import from Images

This guide explains how to use `scripts/wordbase_import/import_words_from_images.py` to import vocabulary from page images into LexiLand Wordbase.

## What It Does

The script runs in two phases:

1. **Extract** — reads images from a folder and calls LexiLand `/api/extract-words` to pull English terms from each page.
2. **Complete** — for each term, fills missing Wordbase fields until the entry is complete:
   - definition, translation, pronunciation, part_of_speech
   - example, example_translation, tags
   - memory_tips, memory_image

Progress is saved to `scripts/wordbase_import/progress.json`.  
Reports are written to `scripts/wordbase_import/reports/`.

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
| `APP_API_BASE_URL` | API base URL (default: `https://learn.lexiland.cc`) |
| `IMPORT_LOCALE` | Locale for memory tips (default: `zh-Hant`) |

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
