from __future__ import annotations

import importlib
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[2]
IMPORT_DIR = REPO_ROOT / "scripts" / "wordbase_import"


def install_dependency_stubs() -> None:
    if str(IMPORT_DIR) not in sys.path:
        sys.path.insert(0, str(IMPORT_DIR))

    dotenv_stub = types.ModuleType("dotenv")
    dotenv_stub.load_dotenv = lambda *args, **kwargs: None
    sys.modules.setdefault("dotenv", dotenv_stub)

    supabase_stub = types.ModuleType("supabase")
    supabase_stub.Client = object
    supabase_stub.create_client = lambda *args, **kwargs: object()
    sys.modules.setdefault("supabase", supabase_stub)

    httpx_stub = types.ModuleType("httpx")
    httpx_stub.ProxyError = RuntimeError
    httpx_stub.Timeout = lambda *args, **kwargs: None
    httpx_stub.Client = lambda *args, **kwargs: types.SimpleNamespace(close=lambda: None)
    sys.modules.setdefault("httpx", httpx_stub)

    pil_stub = types.ModuleType("PIL")
    image_stub = types.ModuleType("PIL.Image")
    image_stub.open = lambda *args, **kwargs: None
    pil_stub.Image = image_stub
    sys.modules.setdefault("PIL", pil_stub)
    sys.modules.setdefault("PIL.Image", image_stub)


install_dependency_stubs()

auth = importlib.import_module("auth")
import_words = importlib.import_module("import_words_from_images")


COMPLETE_ENTRY = {
    "term": "apple",
    "definition": "A fruit.",
    "translation": "蘋果",
    "pronunciation": "ap-uhl",
    "part_of_speech": "noun",
    "example": "I ate an apple.",
    "example_translation": "我吃了一個蘋果。",
    "tags": ["fruit"],
    "memory_tips_by_locale": {
        "zh-Hant": {
            "tips": [{"method": "link", "content": "Apple sounds like app."}],
            "savedAt": "2026-01-01T00:00:00Z",
        }
    },
    "memory_image": {"imageUrl": "https://example.test/apple.png"},
}


class FakeApi:
    def complete_word(self, term: str, locale: str) -> dict:
        return {
            "term": term,
            "definition": COMPLETE_ENTRY["definition"],
            "translation": COMPLETE_ENTRY["translation"],
            "pronunciation": COMPLETE_ENTRY["pronunciation"],
            "part_of_speech": COMPLETE_ENTRY["part_of_speech"],
            "example": COMPLETE_ENTRY["example"],
            "example_translation": COMPLETE_ENTRY["example_translation"],
            "tags": COMPLETE_ENTRY["tags"],
        }

    def memory_tips(self, word_context: dict, locale: str) -> dict:
        return {"tips": [{"method": "link", "content": "Apple sounds like app."}]}

    def memory_image(self, word_context: dict) -> dict:
        return {"imageUrl": "https://example.test/apple.png"}


class FakeImportAuth:
    client = object()
    contributor_id = "contributor-id"

    def run(self, action):
        return action()


class FakeClient:
    def __init__(self, session: dict):
        self.auth = types.SimpleNamespace(
            get_session=lambda: types.SimpleNamespace(
                access_token=session["access_token"],
                refresh_token=session["refresh_token"],
            ),
            get_user=lambda: types.SimpleNamespace(
                user=types.SimpleNamespace(id=session["user_id"], email=session["email"])
            ),
        )


class ImporterRegressionTests(unittest.TestCase):
    def test_process_term_does_not_mark_complete_when_detail_fetch_fails(self) -> None:
        progress = {"terms": {}}

        with (
            patch.object(import_words, "fetch_entry", return_value=None),
            patch.object(import_words, "fetch_entry_resolved", return_value=None),
            patch.object(import_words, "upsert_details", return_value=None),
        ):
            record = import_words.process_term(
                term="apple",
                locale="zh-Hant",
                api=FakeApi(),
                import_auth=FakeImportAuth(),
                progress=progress,
                dry_run=False,
                max_term_attempts=3,
            )

        self.assertEqual(record["status"], "incomplete")
        self.assertIn("could not be read", record["last_errors"]["complete"])

    def test_process_term_requires_verified_memory_tips_after_upsert(self) -> None:
        progress = {"terms": {}}
        entry_without_tips = {
            **COMPLETE_ENTRY,
            "memory_tips_by_locale": {},
            "memory_image": COMPLETE_ENTRY["memory_image"],
        }

        with (
            patch.object(import_words, "fetch_entry", return_value=entry_without_tips),
            patch.object(import_words, "fetch_entry_resolved", return_value=entry_without_tips),
            patch.object(import_words, "upsert_memory_tips", return_value=None),
        ):
            record = import_words.process_term(
                term="apple",
                locale="zh-Hant",
                api=FakeApi(),
                import_auth=FakeImportAuth(),
                progress=progress,
                dry_run=False,
                max_term_attempts=3,
            )

        self.assertEqual(record["status"], "incomplete")
        self.assertIn("Memory tips upsert could not be verified", record["last_errors"]["memory_tips"])

    def test_persist_client_session_does_not_overwrite_newer_tokens(self) -> None:
        older_session = {
            "access_token": "old-access",
            "refresh_token": "old-refresh",
            "user_id": "user-id",
            "email": "importer@example.test",
        }
        newer_session = {
            **older_session,
            "access_token": "new-access",
            "refresh_token": "new-refresh",
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            session_path = Path(temp_dir) / "import-session.json"
            session_path.write_text(json.dumps(newer_session), encoding="utf-8")

            stored = auth.persist_client_session(
                FakeClient(older_session),
                session_path,
                expected_session=older_session,
            )

            self.assertEqual(stored, newer_session)
            self.assertEqual(json.loads(session_path.read_text(encoding="utf-8")), newer_session)

    def test_import_auth_run_allows_refresh_before_action(self) -> None:
        import_auth = auth.ImportAuth.__new__(auth.ImportAuth)
        import_auth.client = object()
        import_auth.session_path = Path("unused-session.json")
        import_auth.import_user_email = "importer@example.test"
        import_auth.contributor_id = "user-id"
        import_auth._last_synced_session = {
            "access_token": "access",
            "refresh_token": "refresh",
            "user_id": "user-id",
            "email": "importer@example.test",
        }
        calls: list[bool] = []

        def sync_session(*, allow_refresh: bool = False) -> None:
            calls.append(allow_refresh)

        import_auth.sync_session = sync_session

        with patch.object(auth, "persist_client_session", return_value=import_auth._last_synced_session):
            result = import_auth.run(lambda: "ok")

        self.assertEqual(result, "ok")
        self.assertEqual(calls, [True])


if __name__ == "__main__":
    unittest.main()
