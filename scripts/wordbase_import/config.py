from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_IMAGE_DIR = Path("/Users/mac/racer/projects/tempWordImage")
DEFAULT_PDF_DIR = Path("/Users/mac/racer/book/dk1w3")
DEFAULT_SESSION_PATH = Path.home() / ".lexiland" / "import-session.json"
DEFAULT_PROGRESS_PATH = Path(__file__).resolve().parent / "progress.json"
DEFAULT_PDF_PROGRESS_PATH = Path(__file__).resolve().parent / "progress-pdf.json"
DEFAULT_REPORT_DIR = Path(__file__).resolve().parent / "reports"
DEFAULT_PDF_REPORT_DIR = Path(__file__).resolve().parent / "reports" / "pdf"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PDF_EXTENSIONS = {".pdf"}
DEFAULT_PDF_ZOOM = 2.0
MAX_IMAGE_WIDTH = 1600
JPEG_QUALITY = 85


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    api_base_url: str
    image_dir: Path
    pdf_dir: Path
    pdf_zoom: float
    locale: str
    session_path: Path
    progress_path: Path
    report_dir: Path
    import_user_email: str
    auth_redirect_url: str
    import_user_password: str
    max_rounds: int
    max_term_attempts: int
    round_pause_seconds: float
    request_pause_seconds: float
    image_request_pause_seconds: float
    max_retries: int


def _require(name: str, value: str) -> str:
    if not value.strip():
        raise ValueError(f"Missing required setting: {name}")
    return value.strip()


def load_settings(
    *,
    image_dir: Path | None = None,
    pdf_dir: Path | None = None,
    pdf_zoom: float | None = None,
    max_rounds: int | None = None,
    max_term_attempts: int | None = None,
    round_pause_seconds: float | None = None,
    progress_path: Path | None = None,
    report_dir: Path | None = None,
    default_progress_path: Path | None = None,
    default_report_dir: Path | None = None,
) -> Settings:
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env.local", override=True)

    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or ""
    supabase_anon_key = (
        os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY") or ""
    )

    return Settings(
        supabase_url=_require("VITE_SUPABASE_URL", supabase_url),
        supabase_anon_key=_require("VITE_SUPABASE_ANON_KEY", supabase_anon_key),
        api_base_url=(os.getenv("APP_API_BASE_URL") or "https://learn.lexiland.cc").rstrip("/"),
        image_dir=image_dir or Path(os.getenv("IMAGE_DIR", str(DEFAULT_IMAGE_DIR))),
        pdf_dir=pdf_dir or Path(os.getenv("PDF_DIR", str(DEFAULT_PDF_DIR))),
        pdf_zoom=pdf_zoom
        if pdf_zoom is not None
        else float(os.getenv("PDF_RENDER_ZOOM", str(DEFAULT_PDF_ZOOM))),
        locale=os.getenv("IMPORT_LOCALE", "zh-Hant"),
        session_path=Path(os.getenv("IMPORT_SESSION_PATH", str(DEFAULT_SESSION_PATH))),
        progress_path=progress_path
        or Path(
            os.getenv(
                "IMPORT_PROGRESS_PATH",
                str(default_progress_path or DEFAULT_PROGRESS_PATH),
            )
        ),
        report_dir=report_dir
        or Path(
            os.getenv(
                "IMPORT_REPORT_DIR",
                str(default_report_dir or DEFAULT_REPORT_DIR),
            )
        ),
        import_user_email=os.getenv("IMPORT_USER_EMAIL", "").strip(),
        auth_redirect_url=(
            os.getenv("VITE_AUTH_REDIRECT_URL")
            or os.getenv("IMPORT_AUTH_REDIRECT_URL")
            or "https://learn.lexiland.cc"
        ).strip(),
        import_user_password=os.getenv("IMPORT_USER_PASSWORD", "").strip(),
        max_rounds=max_rounds if max_rounds is not None else int(os.getenv("IMPORT_MAX_ROUNDS", "20")),
        max_term_attempts=max_term_attempts
        if max_term_attempts is not None
        else int(os.getenv("IMPORT_MAX_TERM_ATTEMPTS", "50")),
        round_pause_seconds=round_pause_seconds
        if round_pause_seconds is not None
        else float(os.getenv("IMPORT_ROUND_PAUSE_SECONDS", "60")),
        request_pause_seconds=float(os.getenv("IMPORT_REQUEST_PAUSE_SECONDS", "1")),
        image_request_pause_seconds=float(os.getenv("IMPORT_IMAGE_PAUSE_SECONDS", "2.5")),
        max_retries=int(os.getenv("IMPORT_MAX_RETRIES", "4")),
    )
