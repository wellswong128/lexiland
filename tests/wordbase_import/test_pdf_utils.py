from __future__ import annotations

import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path


def load_pdf_utils():
    repo_root = Path(__file__).resolve().parents[2]

    config_stub = types.ModuleType("config")
    config_stub.JPEG_QUALITY = 85
    config_stub.MAX_IMAGE_WIDTH = 1600
    config_stub.PDF_EXTENSIONS = {".pdf"}
    sys.modules["config"] = config_stub

    pil_stub = types.ModuleType("PIL")
    pil_stub.Image = types.SimpleNamespace()
    sys.modules.setdefault("PIL", pil_stub)

    spec = importlib.util.spec_from_file_location(
        "pdf_utils_under_test",
        repo_root / "scripts" / "wordbase_import" / "pdf_utils.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pdf_utils = load_pdf_utils()


class PdfUtilsCacheTests(unittest.TestCase):
    def test_legacy_cache_without_pdf_dir_does_not_match_by_filename(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_dir = Path(temp_dir)
            (pdf_dir / "unit1.pdf").write_bytes(b"new content")
            page_record = {
                "status": "extracted",
                "pdf_file": "unit1.pdf",
                "terms": ["new"],
            }

            self.assertFalse(pdf_utils.page_cache_matches_dir(page_record, pdf_dir))
            self.assertNotIn("pdf_dir", page_record)

    def test_changed_pdf_dir_clears_same_filename_cache_without_fingerprint(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base_dir = Path(temp_dir)
            old_dir = base_dir / "old"
            new_dir = base_dir / "new"
            old_dir.mkdir()
            new_dir.mkdir()
            (new_dir / "unit1.pdf").write_bytes(b"different book")

            page_key = "unit1.pdf#page-0001"
            progress = {
                "pdf_dir": pdf_utils.normalize_pdf_dir(old_dir),
                "pages": {
                    page_key: {
                        "status": "extracted",
                        "pdf_file": "unit1.pdf",
                        "terms": ["stale"],
                    },
                },
                "terms": {
                    "stale": {
                        "status": "pending",
                        "source_images": [page_key],
                    },
                },
            }

            pdf_utils.sync_pdf_dir_progress(progress, new_dir)

            self.assertEqual({}, progress["pages"])
            self.assertEqual({}, progress["terms"])
            self.assertEqual(pdf_utils.normalize_pdf_dir(new_dir), progress["pdf_dir"])

    def test_changed_pdf_dir_keeps_cache_when_fingerprint_matches(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base_dir = Path(temp_dir)
            old_dir = base_dir / "old"
            new_dir = base_dir / "new"
            old_dir.mkdir()
            new_dir.mkdir()
            current_pdf = new_dir / "unit1.pdf"
            current_pdf.write_bytes(b"same book")

            page_key = "unit1.pdf#page-0001"
            progress = {
                "pdf_dir": pdf_utils.normalize_pdf_dir(old_dir),
                "pages": {
                    page_key: {
                        "status": "extracted",
                        "pdf_file": "unit1.pdf",
                        "pdf_fingerprint": pdf_utils.pdf_file_fingerprint(current_pdf),
                        "terms": ["kept"],
                    },
                },
                "terms": {
                    "kept": {
                        "status": "pending",
                        "source_images": [page_key],
                    },
                },
            }

            pdf_utils.sync_pdf_dir_progress(progress, new_dir)

            self.assertIn(page_key, progress["pages"])
            self.assertIn("kept", progress["terms"])
            self.assertEqual(
                pdf_utils.normalize_pdf_dir(new_dir),
                progress["pages"][page_key]["pdf_dir"],
            )


if __name__ == "__main__":
    unittest.main()
