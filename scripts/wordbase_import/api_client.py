from __future__ import annotations

import base64
import io
import json
import os
import time
from pathlib import Path

import httpx
from PIL import Image

from auth import session_file_lock
from config import MAX_IMAGE_WIDTH, JPEG_QUALITY, IMAGE_EXTENSIONS, REPO_ROOT
from production_guard import assert_bulk_api_allowed


RETRYABLE_STATUS = {429, 500, 502, 503, 504}
RATE_LIMIT_RETRY_ATTEMPTS = 3
RATE_LIMIT_RETRY_SECONDS = 60.0
TRANSIENT_AI_MARKERS = (
    "internalservererror",
    "upstream_error",
    "do_request_failed",
    "openaiexception",
    "upstream error",
    "expected ',' or '}'",
    "unexpected token",
    "did not include memory tips",
    "ai response did not include",
)


def _extract_error_message(data: dict, status_code: int) -> str:
    error = data.get("error") if isinstance(data, dict) else None
    if isinstance(error, dict):
        message = error.get("message") or error.get("error") or error.get("code")
        if message:
            return str(message)
        return json.dumps(error, ensure_ascii=False)
    if error:
        return str(error)
    message = data.get("message") if isinstance(data, dict) else None
    return str(message or f"Request failed ({status_code})")


def _is_rate_limit_error(status_code: int | None, message: object) -> bool:
    if status_code == 429:
        return True
    lowered = str(message).lower()
    return "rate limit" in lowered or "too many requests" in lowered


def is_transient_ai_error(status_code: int | None, message: object) -> bool:
    if status_code in RETRYABLE_STATUS:
        return True
    lowered = str(message).lower()
    return any(marker in lowered for marker in TRANSIENT_AI_MARKERS)


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
        self.import_api_key = os.getenv("IMPORT_API_KEY", "").strip()
        self.session_path = Path(
            os.getenv("IMPORT_SESSION_PATH", str(Path.home() / ".lexiland" / "import-session.json"))
        )
        self._client = httpx.Client(timeout=httpx.Timeout(120.0, connect=30.0))

    def close(self) -> None:
        self._client.close()

    def _sleep(self, seconds: float) -> None:
        if seconds > 0:
            time.sleep(seconds)

    def _backoff(self, attempt: int) -> float:
        return [0.0, 5.0, 15.0, 45.0][min(attempt, 3)]

    def _wait_for_rate_limit(self, path: str, retry_number: int) -> None:
        print(
            f"Rate limit from {path}; waiting {int(RATE_LIMIT_RETRY_SECONDS)}s "
            f"before retry {retry_number}/{RATE_LIMIT_RETRY_ATTEMPTS}.",
            flush=True,
        )
        self._sleep(RATE_LIMIT_RETRY_SECONDS)

    def _read_bearer_token(self) -> str:
        if not self.session_path.exists():
            return ""

        try:
            with session_file_lock(self.session_path):
                payload = json.loads(self.session_path.read_text(encoding="utf-8"))
        except Exception:
            return ""

        return str(payload.get("access_token", "")).strip()

    def _request_json(self, path: str, payload: dict, *, pause_after: float) -> dict:
        assert_bulk_api_allowed(self.base_url, path)
        url = f"{self.base_url}{path}"
        last_error: Exception | None = None
        rate_limit_retries = 0
        generic_retries = 0

        while True:
            try:
                headers = {}
                bearer_token = self._read_bearer_token()
                if self.import_api_key:
                    headers["x-lexiland-import-key"] = self.import_api_key
                elif bearer_token:
                    headers["Authorization"] = f"Bearer {bearer_token}"
                response = self._client.post(url, json=payload, headers=headers)
            except httpx.RequestError as error:
                last_error = ApiError(str(error), retryable=True)
                if generic_retries < self.max_retries - 1:
                    generic_retries += 1
                    self._sleep(self._backoff(generic_retries))
                    continue
                raise last_error

            try:
                data = response.json()
            except json.JSONDecodeError:
                text = response.text.strip()
                retryable = is_transient_ai_error(response.status_code, text)
                last_error = ApiError(
                    text or f"Non-JSON response ({response.status_code})",
                    status_code=response.status_code,
                    retryable=retryable,
                )
                if _is_rate_limit_error(response.status_code, text):
                    if rate_limit_retries < RATE_LIMIT_RETRY_ATTEMPTS:
                        rate_limit_retries += 1
                        self._wait_for_rate_limit(path, rate_limit_retries)
                        continue
                    raise last_error
                if retryable and generic_retries < self.max_retries - 1:
                    generic_retries += 1
                    self._sleep(self._backoff(generic_retries))
                    continue
                raise last_error

            if response.status_code >= 400:
                message = _extract_error_message(data, response.status_code)
                if response.status_code == 401:
                    has_auth = bool(headers.get("Authorization") or headers.get("x-lexiland-import-key"))
                    if not has_auth:
                        message = (
                            f"{message} "
                            "No API auth header was sent. "
                            "Set IMPORT_API_KEY or ensure IMPORT_SESSION_PATH points to a valid session."
                        )
                    elif headers.get("x-lexiland-import-key") and not headers.get("Authorization"):
                        message = (
                            f"{message} "
                            "IMPORT_API_KEY was sent but rejected. "
                            "Make sure IMPORT_API_KEY in local .env.local exactly matches Vercel "
                            "Environment Variables and redeploy learn.lexiland.cc."
                        )
                retryable = is_transient_ai_error(response.status_code, message)
                last_error = ApiError(message, status_code=response.status_code, retryable=retryable)
                if _is_rate_limit_error(response.status_code, message):
                    if rate_limit_retries < RATE_LIMIT_RETRY_ATTEMPTS:
                        rate_limit_retries += 1
                        self._wait_for_rate_limit(path, rate_limit_retries)
                        continue
                    raise last_error
                if retryable and generic_retries < self.max_retries - 1:
                    generic_retries += 1
                    self._sleep(self._backoff(generic_retries))
                    continue
                raise last_error

            self._sleep(pause_after)
            return data

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

    def complete_word(self, term: str, locale: str, *, max_attempts: int = 3) -> dict:
        from text_locale import has_placeholder_translation, is_incomplete_exam_phrase_translation

        last_error: ApiError | None = None
        last_suggestion: dict | None = None

        for _ in range(max_attempts):
            suggestion = self._complete_word_once(term, locale)
            last_suggestion = suggestion
            translation = str(suggestion.get("translation", "")).strip()
            example_translation = str(suggestion.get("example_translation", "")).strip()
            if (
                not has_placeholder_translation(translation)
                and not has_placeholder_translation(example_translation)
                and not is_incomplete_exam_phrase_translation(term, translation)
            ):
                return suggestion
            last_error = ApiError(f"Incomplete translation returned for {term!r}.")

        if last_suggestion is not None:
            if is_incomplete_exam_phrase_translation(term, last_suggestion.get("translation", "")):
                try:
                    return self._repair_exam_phrase_translation(term, locale, last_suggestion)
                except Exception as error:
                    last_error = ApiError(str(error))
            raise last_error or ApiError(f"Incomplete translation returned for {term!r}.")
        raise ApiError(f"Complete-word failed for {term!r}.")

    def _repair_exam_phrase_translation(self, term: str, locale: str, base: dict) -> dict:
        from dotenv import load_dotenv
        from terms import resolve_upsert_term
        from text_locale import is_incomplete_exam_phrase_translation

        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / ".env.local", override=True)

        api_key = os.getenv("AGNES_API_KEY", "").strip()
        if not api_key:
            raise ApiError("AGNES_API_KEY is required to repair exam phrase translations.")

        chinese_label = "Simplified Chinese" if locale == "zh-Hans" else "Traditional Chinese"
        prompt = (
            f'Translate this English examination skill phrase for a Hong Kong vocabulary card.\n'
            f'Phrase: {term}\n'
            f'Return JSON only: {{"translation": "..."}}\n'
            f'Write translation in {chinese_label}. Translate the FULL phrase, not just the first word.\n'
            f'Do not use asterisks, placeholders, or synonym lists like "評估；評價".\n'
            f'Example: "evaluate French Revolution" -> "評估法國大革命".'
        )

        response = self._client.post(
            "https://apihub.agnes-ai.com/v1/chat/completions",
            json={
                "model": os.getenv("AGNES_MODEL", "agnes-2.0-flash"),
                "messages": [
                    {"role": "system", "content": "Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

        if response.status_code >= 400:
            raise ApiError(response.text or f"Agnes request failed ({response.status_code})")

        content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise ApiError("Agnes response did not include text output.")

        payload = json.loads(content)
        translation = str(payload.get("translation", "")).strip()
        if not translation or is_incomplete_exam_phrase_translation(term, translation):
            raise ApiError(f"Could not repair exam phrase translation for {term!r}.")

        repaired = dict(base)
        repaired["term"] = resolve_upsert_term(term, str(base.get("term", term)).strip(), term)
        repaired["translation"] = translation
        return repaired

    def _complete_word_once(self, term: str, locale: str) -> dict:
        data = self._request_json(
            "/api/complete-word",
            {"term": term, "locale": locale},
            pause_after=self.request_pause_seconds,
        )
        from terms import resolve_upsert_term

        suggestion = data.get("suggestion") or {}
        return {
            "term": resolve_upsert_term(term, str(suggestion.get("term", term)).strip(), ""),
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
