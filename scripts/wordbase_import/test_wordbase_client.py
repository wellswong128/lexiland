from __future__ import annotations

import unittest
import sys
import types
from types import SimpleNamespace
from typing import Any

supabase_stub = types.ModuleType("supabase")
supabase_stub.Client = object
sys.modules["supabase"] = supabase_stub

from wordbase_client import WORDBASE_COLUMNS, upsert_memory_tips


class FakeWordbaseClient:
    def __init__(self) -> None:
        self.updated_rows: list[dict[str, Any]] = []

    def table(self, table_name: str) -> "FakeQuery":
        self.table_name = table_name
        return FakeQuery(self)


class FakeQuery:
    def __init__(self, client: FakeWordbaseClient) -> None:
        self.client = client
        self.selected_columns = ""
        self.update_row: dict[str, Any] | None = None

    def select(self, columns: str) -> "FakeQuery":
        self.selected_columns = columns
        return self

    def eq(self, _column: str, _value: str) -> "FakeQuery":
        return self

    def limit(self, _limit: int) -> "FakeQuery":
        return self

    def update(self, row: dict[str, Any]) -> "FakeQuery":
        self.update_row = row
        return self

    def insert(self, row: dict[str, Any]) -> "FakeQuery":
        self.update_row = row
        return self

    def execute(self) -> SimpleNamespace:
        if self.selected_columns == WORDBASE_COLUMNS:
            raise RuntimeError("supabase read failed")
        if self.selected_columns == "id":
            return SimpleNamespace(data=[{"id": "existing-row"}])
        if self.update_row is not None:
            self.client.updated_rows.append(self.update_row)
            return SimpleNamespace(data=[self.update_row])
        return SimpleNamespace(data=[])


class WordbaseClientTests(unittest.TestCase):
    def test_memory_tip_upsert_aborts_when_existing_entry_fetch_fails(self) -> None:
        client = FakeWordbaseClient()

        with self.assertRaisesRegex(RuntimeError, "supabase read failed"):
            upsert_memory_tips(
                client,
                {
                    "term": "apple",
                    "definition": "A fruit.",
                    "translation": "蘋果",
                    "pronunciation": "ping2 gwo2",
                    "part_of_speech": "noun",
                    "example": "I ate an apple.",
                    "example_translation": "我吃了一個蘋果。",
                    "tags": ["food"],
                },
                "zh-Hant",
                {"tips": [{"method": "association", "content": "Apple sounds familiar."}]},
                "contributor-id",
            )

        self.assertEqual(client.updated_rows, [])


if __name__ == "__main__":
    unittest.main()
