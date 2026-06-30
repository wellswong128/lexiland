from __future__ import annotations

import sys
import tempfile
import types
import unittest
from pathlib import Path


WORDBASE_IMPORT_DIR = Path(__file__).resolve().parents[2] / "scripts" / "wordbase_import"
sys.path.insert(0, str(WORDBASE_IMPORT_DIR))

try:
    from PIL import Image as _Image  # noqa: F401
except ModuleNotFoundError:
    pil_module = types.ModuleType("PIL")
    image_module = types.ModuleType("PIL.Image")
    pil_module.Image = image_module
    sys.modules["PIL"] = pil_module
    sys.modules["PIL.Image"] = image_module

config_module = types.ModuleType("config")
config_module.JPEG_QUALITY = 80
config_module.MAX_IMAGE_WIDTH = 1600
config_module.PDF_EXTENSIONS = {".pdf"}
sys.modules["config"] = config_module

from pdf_utils import normalize_pdf_dir, page_cache_matches_dir, sync_pdf_dir_progress


class PdfProgressCacheTests(unittest.TestCase):
    def test_sync_clears_same_named_pdf_cache_when_pdf_dir_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old_dir = root / "old"
            new_dir = root / "new"
            old_dir.mkdir()
            new_dir.mkdir()
            (old_dir / "book.pdf").write_bytes(b"%PDF old")
            (new_dir / "book.pdf").write_bytes(b"%PDF new")

            progress = {
                "pdf_dir": normalize_pdf_dir(old_dir),
                "pages": {
                    "book.pdf#page-0001": {
                        "status": "extracted",
                        "pdf_file": "book.pdf",
                        "pdf_dir": normalize_pdf_dir(old_dir),
                        "extracted_terms": ["old-only-term"],
                    },
                },
            }

            sync_pdf_dir_progress(progress, new_dir)

            self.assertEqual(progress["pdf_dir"], normalize_pdf_dir(new_dir))
            self.assertEqual(progress["pages"], {})

    def test_legacy_page_cache_without_pdf_dir_can_be_adopted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pdf_dir = Path(tmp)
            (pdf_dir / "book.pdf").write_bytes(b"%PDF")
            page_record = {
                "status": "extracted",
                "pdf_file": "book.pdf",
                "extracted_terms": ["legacy-term"],
            }

            self.assertTrue(page_cache_matches_dir(page_record, pdf_dir))
            self.assertEqual(page_record["pdf_dir"], normalize_pdf_dir(pdf_dir))

    def test_legacy_page_cache_is_not_adopted_during_dir_migration(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pdf_dir = Path(tmp)
            (pdf_dir / "book.pdf").write_bytes(b"%PDF")
            page_record = {
                "status": "extracted",
                "pdf_file": "book.pdf",
                "extracted_terms": ["legacy-term"],
            }

            self.assertFalse(
                page_cache_matches_dir(
                    page_record,
                    pdf_dir,
                    allow_legacy_without_dir=False,
                ),
            )
            self.assertNotIn("pdf_dir", page_record)


if __name__ == "__main__":
    unittest.main()
