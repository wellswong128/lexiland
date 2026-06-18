from __future__ import annotations

import base64
import io
import json
import time
from pathlib import Path

import httpx
from PIL import Image

from config import MAX_IMAGE_WIDTH, JPEG_QUALITY, IMAGE_EXTENSIONS


RETRYABLE_STATUS = {429, 502, 503, 504}


class ApiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, retryable: bool = False):
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


class LexiLandApiClient:
    def __init__(
        self,
        base_url: str,
        *,
        max_retries: int = 4,
        request_pause_seconds: float = 1.0,
        image_request_pause_seconds: float = 2.5,
    ):
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self.request_pause_seconds = request_pause_seconds
        self.image_request_pause_seconds = image_request_pause_seconds
        self._client = httpx.Client(timeout=httpx.Timeout(120.0, connect=30.0))

    def close(self) -> None:
        self._client.close()

    def _sleep(self, seconds: float) -> None:
        if seconds > 0:
            time.sleep(seconds)

    def _backoff(self, attempt: int) -> float:
        return [0.0, 5.0, 15.0, 45.0][min(attempt, 3)]

    def _request_json(self, path: str, payload: dict, *, pause_after: float) -> dict:
        url = f"{self.base_url}{path}"
        last_error: Exception | None = None

        for attempt in range(self.max_retries):
            if attempt > 0:
                self._sleep(self._backoff(attempt))

            try:
                response = self._client.post(url, json=payload)
            except httpx.RequestError as error:
                last_error = ApiError(str(error), retryable=True)
                continue

            try:
                data = response.json()
            except json.JSONDecodeError:
                text = response.text.strip()
                retryable = response.status_code in RETRYABLE_STATUS
                last_error = ApiError(
                    text or f"Non-JSON response ({response.status_code})",
                    status_code=response.status_code,
                    retryable=retryable,
                )
                if retryable and attempt < self.max_retries - 1:
                    continue
                raise last_error

            if response.status_code >= 400:
                message = data.get("error") or f"Request failed ({response.status_code})"
                retryable = response.status_code in RETRYABLE_STATUS
                last_error = ApiError(message, status_code=response.status_code, retryable=retryable)
                if retryable and attempt < self.max_retries - 1:
                    continue
                raise last_error

            self._sleep(pause_after)
            return data

        raise last_error or ApiError("Request failed.")

    def extract_words(self, image_data_url: str) -> list[str]:
        from terms import split_into_single_word_terms

        data = self._request_json(
            "/api/extract-words-from-image",
            {"imageDataUrl": image_data_url},
            pause_after=self.request_pause_seconds,
        )
        words = data.get("words") or []
        return split_into_single_word_terms(
            [item.get("term") if isinstance(item, dict) else item for item in words]
        )

    def complete_word(self, term: str, locale: str) -> dict:
        data = self._request_json(
            "/api/complete-word",
            {"term": term, "locale": locale},
            pause_after=self.request_pause_seconds,
        )
        suggestion = data.get("suggestion") or {}
        return {
            "term": str(suggestion.get("term", term)).strip(),
            "definition": str(suggestion.get("definition", "")).strip(),
            "translation": str(suggestion.get("translation", "")).strip(),
            "pronunciation": str(suggestion.get("pronunciation", "")).strip(),
            "part_of_speech": str(suggestion.get("partOfSpeech", "")).strip(),
            "example": str(suggestion.get("example", "")).strip(),
            "example_translation": str(suggestion.get("exampleTranslation", "")).strip(),
            "tags": [
                str(tag).strip()
                for tag in (suggestion.get("tags") or [])
                if str(tag).strip()
            ],
        }

    def memory_tips(self, word: dict, locale: str) -> dict:
        data = self._request_json(
            "/api/word-memory-tips",
            {
                "term": word["term"],
                "definition": word.get("definition", ""),
                "translation": word.get("translation", ""),
                "partOfSpeech": word.get("part_of_speech", ""),
                "example": word.get("example", ""),
                "locale": locale,
            },
            pause_after=self.request_pause_seconds,
        )
        memory_tips = data.get("memoryTips") or {}
        tips = memory_tips.get("tips") or []
        cleaned = [
            {
                "method": str(tip.get("method", "")).strip(),
                "content": str(tip.get("content", "")).strip(),
            }
            for tip in tips
            if isinstance(tip, dict)
        ]
        cleaned = [tip for tip in cleaned if tip["method"] and tip["content"]]
        return {
            "summary": str(memory_tips.get("summary", "")).strip(),
            "tips": cleaned[:5],
        }

    def memory_image(self, word: dict) -> dict:
        data = self._request_json(
            "/api/word-memory-image",
            {
                "term": word["term"],
                "definition": word.get("definition", ""),
                "translation": word.get("translation", ""),
                "partOfSpeech": word.get("part_of_speech", ""),
                "example": word.get("example", ""),
            },
            pause_after=self.image_request_pause_seconds,
        )
        image_url = str(data.get("imageUrl", "")).strip()
        if not image_url:
            raise ApiError("AI response did not include imageUrl.")
        return {
            "imageUrl": image_url,
            "prompt": str(data.get("prompt", "")).strip(),
        }


def image_to_data_url(path: Path) -> str:
    with Image.open(path) as image:
        converted = image.convert("RGB")
        if converted.width > MAX_IMAGE_WIDTH:
            ratio = MAX_IMAGE_WIDTH / converted.width
            converted = converted.resize(
                (MAX_IMAGE_WIDTH, max(1, int(converted.height * ratio))),
                Image.Resampling.LANCZOS,
            )

        buffer = io.BytesIO()
        converted.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"


def list_image_files(image_dir: Path) -> list[Path]:
    if not image_dir.exists():
        return []

    files = [
        path
        for path in sorted(image_dir.iterdir())
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return files
