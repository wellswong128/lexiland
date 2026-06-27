from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

from config import JPEG_QUALITY, MAX_IMAGE_WIDTH, PDF_EXTENSIONS

try:
    import fitz
except ImportError:  # pragma: no cover - optional at import time
    fitz = None


def require_fitz() -> None:
    if fitz is None:
        raise ImportError(
            "PyMuPDF is required for PDF import. "
            "Run: pip install -r scripts/wordbase_import/requirements.txt"
        )


def normalize_pdf_dir(pdf_dir: Path) -> str:
    return str(pdf_dir.expanduser().resolve())


def list_pdf_files(pdf_dir: Path) -> list[Path]:
    if not pdf_dir.exists():
        return []

    return [
        path
        for path in sorted(pdf_dir.iterdir())
        if path.is_file() and path.suffix.lower() in PDF_EXTENSIONS
    ]


def clear_page_cache_for_pdfs(progress: dict, pdf_names: set[str]) -> int:
    pages = progress.setdefault("pages", {})
    keys_to_remove = [
        key
        for key in pages
        if any(key.startswith(f"{pdf_name}#page-") for pdf_name in pdf_names)
    ]
    for key in keys_to_remove:
        del pages[key]
    return len(keys_to_remove)


def sync_pdf_dir_progress(
    progress: dict,
    pdf_dir: Path,
    *,
    reset_extract: bool = False,
) -> None:
    normalized = normalize_pdf_dir(pdf_dir)
    pdf_names = {path.name for path in list_pdf_files(pdf_dir)}
    stored = progress.get("pdf_dir")
    pages = progress.setdefault("pages", {})

    if reset_extract:
        cleared = clear_page_cache_for_pdfs(progress, pdf_names)
        print(f"[extract] reset requested; cleared {cleared} cached page(s) for current PDF dir")
    elif stored is not None and stored != normalized:
        cached_names = {
            page_record.get("pdf_file")
            for page_record in pages.values()
            if page_record.get("pdf_file")
        }
        if cached_names and cached_names <= pdf_names:
            migrated = 0
            for page_record in pages.values():
                if page_record.get("pdf_file") in pdf_names:
                    page_record["pdf_dir"] = normalized
                    migrated += 1
            print(
                f"[extract] pdf_dir moved ({stored} -> {normalized}); "
                f"kept {migrated} cached page(s)"
            )
        else:
            cleared = clear_page_cache_for_pdfs(progress, pdf_names)
            print(
                f"[extract] pdf_dir changed ({stored} -> {normalized}); "
                f"cleared {cleared} cached page(s) for current PDF dir"
            )

    progress["pdf_dir"] = normalized


def page_cache_matches_dir(page_record: dict, pdf_dir: Path) -> bool:
    normalized = normalize_pdf_dir(pdf_dir)
    stored = page_record.get("pdf_dir")
    if stored == normalized:
        return True

    pdf_file = page_record.get("pdf_file")
    if pdf_file and (pdf_dir / pdf_file).is_file():
        page_record["pdf_dir"] = normalized
        return True

    return not stored


def count_pdf_pages(pdf_path: Path) -> int:
    require_fitz()
    with fitz.open(pdf_path) as document:
        return document.page_count


def page_key(pdf_path: Path, page_index: int) -> str:
    return f"{pdf_path.name}#page-{page_index + 1:04d}"


def page_label_from_pdf_page(pdf_path: Path, page_index: int) -> str:
    stem = pdf_path.stem.replace("-", " ").replace("_", " ").strip().lower()
    return f"{stem} page {page_index + 1}"


def pixmap_to_data_url(pixmap: fitz.Pixmap) -> str:
    if pixmap.n - pixmap.alpha >= 4:
        pixmap = fitz.Pixmap(fitz.csRGB, pixmap)

    image = Image.open(io.BytesIO(pixmap.tobytes("png"))).convert("RGB")
    if image.width > MAX_IMAGE_WIDTH:
        ratio = MAX_IMAGE_WIDTH / image.width
        image = image.resize(
            (MAX_IMAGE_WIDTH, max(1, int(image.height * ratio))),
            Image.Resampling.LANCZOS,
        )

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def pdf_page_to_data_url(pdf_path: Path, page_index: int, *, zoom: float = 2.0) -> str:
    require_fitz()
    matrix = fitz.Matrix(zoom, zoom)

    with fitz.open(pdf_path) as document:
        if page_index < 0 or page_index >= document.page_count:
            raise ValueError(
                f"Page {page_index + 1} is out of range for {pdf_path.name} "
                f"({document.page_count} pages)."
            )
        page = document.load_page(page_index)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)

    return pixmap_to_data_url(pixmap)
