from __future__ import annotations

import importlib
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


SCRIPT_DIR = Path(__file__).resolve().parents[2] / "scripts" / "wordbase_import"


def install_import_stubs() -> None:
    api_client = types.ModuleType("api_client")
    api_client.ApiError = RuntimeError
    api_client.LexiLandApiClient = object
    api_client.image_to_data_url = lambda path: ""
    api_client.list_image_files = lambda image_dir: []
    sys.modules["api_client"] = api_client

    auth = types.ModuleType("auth")
    auth.AuthError = RuntimeError
    auth.ImportAuth = object
    sys.modules["auth"] = auth

    config = types.ModuleType("config")
    config.load_settings = lambda **kwargs: None
    sys.modules["config"] = config

    wordbase_client = types.ModuleType("wordbase_client")
    wordbase_client.fetch_entries = lambda client, terms: {}
    wordbase_client.fetch_entry = lambda client, term: None
    wordbase_client.upsert_details = lambda *args, **kwargs: None
    wordbase_client.upsert_memory_image = lambda *args, **kwargs: None
    wordbase_client.upsert_memory_tips = lambda *args, **kwargs: None
    sys.modules["wordbase_client"] = wordbase_client


def import_importer():
    if str(SCRIPT_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPT_DIR))
    install_import_stubs()
    return importlib.import_module("import_words_from_images")


def complete_entry(term: str = "banana") -> dict:
    return {
        "term": term,
        "definition": "A test definition.",
        "translation": "香蕉",
        "pronunciation": "/test/",
        "part_of_speech": "noun",
        "example": "This is a test example.",
        "example_translation": "這是一個例句。",
        "tags": ["test"],
        "memory_tips_by_locale": {
            "zh-Hant": {
                "tips": [
                    {
                        "method": "sound",
                        "content": "A useful memory tip.",
                    }
                ]
            }
        },
        "memory_image": {"imageUrl": "https://example.com/image.png"},
    }


def incomplete_entry(term: str = "apple") -> dict:
    entry = complete_entry(term)
    entry["memory_image"] = None
    return entry


class ImportWordsFromImagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.importer = import_importer()

    def test_filter_skips_only_complete_wordbase_entries(self) -> None:
        importer = self.importer
        progress = {}

        class Auth:
            client = object()

            def run(self, callback):
                return callback()

        with patch.object(
            importer,
            "fetch_entries",
            return_value={
                "apple": incomplete_entry("apple"),
                "banana": complete_entry("banana"),
            },
        ):
            terms, skipped = importer.filter_terms_against_wordbase(
                raw_terms=["Apple", "Banana"],
                locale="zh-Hant",
                import_auth=Auth(),
                progress=progress,
                filename="page-1.jpg",
                dry_run=False,
                skip_wordbase_check=False,
            )

        self.assertEqual(terms, ["apple"])
        self.assertEqual(skipped, ["banana"])
        self.assertEqual(progress["terms"]["apple"]["status"], "pending")
        self.assertEqual(progress["terms"]["apple"]["missing"], ["memory_image"])
        self.assertNotIn("skipped_reason", progress["terms"]["apple"])
        self.assertEqual(progress["terms"]["banana"]["status"], "complete")
        self.assertEqual(progress["terms"]["banana"]["skipped_reason"], "exists_in_wordbase")

    def test_process_term_completes_existing_incomplete_entry(self) -> None:
        importer = self.importer
        progress = {}
        api = Mock()
        api.memory_image.return_value = {"imageUrl": "https://example.com/generated.png"}

        class Auth:
            client = object()
            contributor_id = "contributor-id"

            def run(self, callback):
                return callback()

        with (
            patch.object(
                importer,
                "fetch_entry",
                side_effect=[incomplete_entry("apple"), complete_entry("apple")],
            ),
            patch.object(importer, "upsert_memory_image") as upsert_memory_image,
        ):
            record = importer.process_term(
                term="apple",
                locale="zh-Hant",
                api=api,
                import_auth=Auth(),
                progress=progress,
                dry_run=False,
                max_term_attempts=3,
            )

        api.memory_image.assert_called_once()
        upsert_memory_image.assert_called_once()
        self.assertEqual(record["status"], "complete")
        self.assertEqual(record["missing"], [])

    def test_process_term_skips_existing_complete_entry(self) -> None:
        importer = self.importer
        progress = {}
        api = Mock()

        class Auth:
            client = object()

            def run(self, callback):
                return callback()

        with patch.object(importer, "fetch_entry", return_value=complete_entry("banana")):
            record = importer.process_term(
                term="banana",
                locale="zh-Hant",
                api=api,
                import_auth=Auth(),
                progress=progress,
                dry_run=False,
                max_term_attempts=3,
            )

        api.complete_word.assert_not_called()
        api.memory_tips.assert_not_called()
        api.memory_image.assert_not_called()
        self.assertEqual(record["status"], "complete")
        self.assertEqual(record["skipped_reason"], "exists_in_wordbase")


if __name__ == "__main__":
    unittest.main()
