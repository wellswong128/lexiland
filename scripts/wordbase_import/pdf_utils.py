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


def list_pdf_files(pdf_dir: Path) -> list[Path]:
    if not pdf_dir.exists():
        return []

    return [
        path
        for path in sorted(pdf_dir.iterdir())
        if path.is_file() and path.suffix.lower() in PDF_EXTENSIONS
    ]


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
