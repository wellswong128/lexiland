from __future__ import annotations

import json
import os
import re
from contextlib import contextmanager
from getpass import getpass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from supabase import Client, create_client

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows
    fcntl = None


class AuthError(Exception):
    pass


LOGIN_HINT = (
    "Run ./scripts/wordbase_import/run-pdf.sh --login "
    "(or ./scripts/wordbase_import/run.sh --login)."
)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _load_session(path: Path) -> dict[str, Any] | None:
    with session_file_lock(path):
        return _read_session_file(path)


def _save_session(path: Path, session: dict[str, Any]) -> None:
    with session_file_lock(path):
        _write_session_file(path, session)


def _session_from_response(response: Any, email: str) -> dict[str, Any]:
    if response.user is None or response.session is None:
        raise AuthError("Supabase did not return a session.")

    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "user_id": response.user.id,
        "email": _normalize_email(email or response.user.email or ""),
    }


def is_auth_error(error: Exception) -> bool:
    message = str(error).lower()
    markers = (
        "jwt",
        "401",
        "unauthorized",
        "expired",
        "refresh token",
        "invalid token",
        "already used",
        "not authenticated",
        "session missing",
    )
    return any(marker in message for marker in markers)


def is_refresh_token_reused_error(error: Exception) -> bool:
    message = str(error).lower()
    return "already used" in message or "invalid refresh token" in message


@contextmanager
def session_file_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_name(f"{path.name}.lock")

    with lock_path.open("a+", encoding="utf-8") as lock_handle:
        if fcntl is not None:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            if fcntl is not None:
                fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


def _read_session_file(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, dict):
        return None

    access_token = str(data.get("access_token", "")).strip()
    refresh_token = str(data.get("refresh_token", "")).strip()
    user_id = str(data.get("user_id", "")).strip()
    email = str(data.get("email", "")).strip()

    if not access_token or not refresh_token:
        return None

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": user_id,
        "email": email,
    }


def _write_session_file(path: Path, session: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(session, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    try:
        path.chmod(0o600)
    except OSError:
        pass


def _session_from_client(
    client: Client,
    *,
    fallback_email: str = "",
    fallback_user_id: str = "",
) -> dict[str, Any]:
    session = client.auth.get_session()
    if session is None:
        raise AuthError("No active Supabase session.")

    user_response = client.auth.get_user()
    user = user_response.user if user_response else None

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user_id": user.id if user else fallback_user_id,
        "email": _normalize_email((user.email if user else "") or fallback_email),
    }


def _client_session_is_valid(client: Client) -> bool:
    try:
        user_response = client.auth.get_user()
        return user_response.user is not None
    except Exception:
        return False


def persist_client_session(
    client: Client,
    session_path: Path,
    *,
    fallback_email: str = "",
    fallback_user_id: str = "",
) -> dict[str, Any]:
    stored = _session_from_client(
        client,
        fallback_email=fallback_email,
        fallback_user_id=fallback_user_id,
    )
    _save_session(session_path, stored)
    return stored


def sync_client_session(
    client: Client,
    session_path: Path,
    *,
    allow_refresh: bool = False,
    fallback_email: str = "",
    fallback_user_id: str = "",
) -> dict[str, Any]:
    with session_file_lock(session_path):
        stored = _read_session_file(session_path)
        if not stored:
            raise AuthError("No saved session.")

        session_applied = False
        for attempt in range(2):
            try:
                client.auth.set_session(stored["access_token"], stored["refresh_token"])
                session_applied = True
                break
            except Exception as error:
                if attempt == 0 and (
                    is_refresh_token_reused_error(error) or is_auth_error(error)
                ):
                    latest = _read_session_file(session_path)
                    if latest and latest != stored:
                        stored = latest
                        continue
                if not allow_refresh:
                    raise AuthError(
                        f"Supabase session expired or invalid. {LOGIN_HINT}"
                    ) from error
                break

        if session_applied and _client_session_is_valid(client):
            updated = _session_from_client(
                client,
                fallback_email=stored.get("email", "") or fallback_email,
                fallback_user_id=stored.get("user_id", "") or fallback_user_id,
            )
            if (
                updated["access_token"] != stored["access_token"]
                or updated["refresh_token"] != stored["refresh_token"]
            ):
                _write_session_file(session_path, updated)
            return updated

        if not allow_refresh:
            raise AuthError(
                f"Supabase session expired or invalid. {LOGIN_HINT}"
            )

        try:
            refresh_response = client.auth.refresh_session(stored["refresh_token"])
        except Exception as error:
            if is_refresh_token_reused_error(error):
                latest = _read_session_file(session_path)
                if latest and latest != stored:
                    try:
                        client.auth.set_session(latest["access_token"], latest["refresh_token"])
                        if _client_session_is_valid(client):
                            return latest
                    except Exception as retry_error:
                        raise AuthError(
                            f"Supabase session expired or invalid. {LOGIN_HINT}"
                        ) from retry_error
            raise AuthError(
                f"Supabase session expired or invalid. {LOGIN_HINT}"
            ) from error

        if refresh_response.session is None or refresh_response.user is None:
            raise AuthError("Could not refresh Supabase session.")

        updated = _session_from_response(refresh_response, stored.get("email", ""))
        client.auth.set_session(updated["access_token"], updated["refresh_token"])
        _write_session_file(session_path, updated)
        return updated


def _parse_query_params(raw: str) -> dict[str, str]:
    query = raw.strip()
    if query.startswith("http://") or query.startswith("https://"):
        parsed = urlparse(query)
        query = parsed.query or parsed.fragment

    query = query.lstrip("#?")
    params = parse_qs(query, keep_blank_values=False)
    return {key: values[0] for key, values in params.items() if values}


def parse_auth_input(raw: str) -> tuple[str, str, dict[str, str]]:
    """Return (token, otp_type, query_params)."""
    value = raw.strip()
    if not value:
        raise AuthError("Login token is required.")

    params = _parse_query_params(value) if ("=" in value or value.startswith("http")) else {}

    if params.get("code"):
        return "", "pkce", params

    if re.fullmatch(r"\d{6}", value):
        return value, "email", params

    token = params.get("token") or params.get("token_hash")
    if token:
        otp_type = params.get("type", "magiclink")
        return token, "magiclink" if otp_type == "magiclink" else otp_type, params

    if re.fullmatch(r"[a-f0-9]{20,}", value, re.IGNORECASE):
        return value, "magiclink", params

    return value, "email", params


def verify_login_token(client: Client, email: str, raw_token: str) -> dict[str, Any]:
    email = _normalize_email(email)
    token, otp_type, params = parse_auth_input(raw_token)
    errors: list[str] = []

    if otp_type == "pkce" and params.get("code"):
        try:
            response = client.auth.exchange_code_for_session({"auth_code": params["code"]})
            return _session_from_response(response, email)
        except Exception as error:
            errors.append(f"pkce: {error}")

    for token_hash_type in ["magiclink", "email", "signup", "invite"]:
        try:
            response = client.auth.verify_otp(
                {
                    "token_hash": token,
                    "type": token_hash_type,
                }
            )
            return _session_from_response(response, email)
        except Exception as error:
            errors.append(f"token_hash/{token_hash_type}: {error}")

    attempt_types = [otp_type, "magiclink", "email", "signup"]
    seen_types: set[str] = set()
    for attempt_type in attempt_types:
        if attempt_type in seen_types:
            continue
        seen_types.add(attempt_type)
        try:
            response = client.auth.verify_otp(
                {
                    "email": email,
                    "token": token,
                    "type": attempt_type,
                }
            )
            return _session_from_response(response, email)
        except Exception as error:
            errors.append(f"{attempt_type}: {error}")

    raise AuthError(
        "Could not verify login token. Request a fresh email and paste the token immediately.\n"
        + " | ".join(errors)
    )


def login_from_browser_session(client: Client) -> dict[str, Any]:
    print(
        "Paste the Supabase session from learn.lexiland.cc:\n"
        "  1. Log in at https://learn.lexiland.cc\n"
        "  2. Open DevTools → Console\n"
        "  3. Run:\n"
        "     copy(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('-auth-token')))))\n"
        "  4. Paste the copied JSON below"
    )
    raw = input("Paste session JSON: ").strip()
    if not raw:
        raise AuthError("Session JSON is required.")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise AuthError(f"Could not parse session JSON: {error}") from error

    if isinstance(payload, dict) and isinstance(payload.get("currentSession"), dict):
        payload = payload["currentSession"]

    access_token = str(payload.get("access_token", "")).strip()
    refresh_token = str(payload.get("refresh_token", "")).strip()
    if not access_token or not refresh_token:
        raise AuthError("Session JSON must include access_token and refresh_token.")

    client.auth.set_session(access_token, refresh_token)
    user_response = client.auth.get_user()
    if user_response.user is None:
        raise AuthError("Browser session is expired. Log in again in the browser and re-copy.")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": user_response.user.id,
        "email": _normalize_email(user_response.user.email or ""),
    }


def login_with_password(client: Client, email: str, password: str) -> dict[str, Any]:
    email = _normalize_email(email)
    password = password.strip()
    if not email or not password:
        raise AuthError("Email and password are required.")

    response = client.auth.sign_in_with_password({"email": email, "password": password})
    return _session_from_response(response, email)


def login_with_email_token(client: Client, email: str, *, auth_redirect_url: str = "") -> dict[str, Any]:
    email = _normalize_email(email)
    if not email:
        raise AuthError("Email is required for login.")

    already_have_token = input(
        "Already have a token from email? [y/N]: ",
    ).strip().lower()

    if already_have_token == "y":
        print(
            "Paste ONE of the following from the latest email only:\n"
            "  • 6-digit code\n"
            "  • full magic link URL\n"
            "  • token=...&type=magiclink...\n"
            "  • redirect URL containing ?code=...\n"
            "  • just the long token value"
        )
        raw_token = input("Paste code or magic-link token: ").strip()
        return verify_login_token(client, email, raw_token)

    print(f"Sending magic link / OTP to {email} ...")
    print("Tip: do not request another email before pasting — that invalidates the token.")

    options: dict[str, Any] = {"should_create_user": True}
    if auth_redirect_url:
        options["email_redirect_to"] = auth_redirect_url

    client.auth.sign_in_with_otp({"email": email, "options": options})

    print(
        "Check your email, then paste ONE of the following:\n"
        "  • 6-digit code from the email\n"
        "  • the full magic link URL\n"
        "  • the link query part, e.g. token=...&type=magiclink&redirect_to=...\n"
        "  • redirect URL containing ?code=...\n"
        "  • just the long token value from the link"
    )
    raw_token = input("Paste code or magic-link token: ").strip()
    return verify_login_token(client, email, raw_token)


def login_interactive(
    client: Client,
    email: str,
    *,
    auth_redirect_url: str = "",
    password: str = "",
) -> dict[str, Any]:
    email = _normalize_email(email)

    if password:
        return login_with_password(client, email, password)

    print("Choose login method:")
    print("  1) Paste browser session from learn.lexiland.cc (recommended)")
    print("  2) Email magic link / OTP")
    print("  3) Password")
    choice = input("Choose [1]: ").strip() or "1"

    if choice == "1":
        return login_from_browser_session(client)
    if choice == "3":
        login_password = getpass("Password: ")
        return login_with_password(client, email, login_password)
    return login_with_email_token(client, email, auth_redirect_url=auth_redirect_url)


def refresh_client_session(client: Client, session_path: Path) -> dict[str, Any]:
    return sync_client_session(client, session_path, allow_refresh=True)


def ensure_authenticated_client(
    supabase_url: str,
    supabase_anon_key: str,
    session_path: Path,
    *,
    force_login: bool = False,
    email: str = "",
    auth_redirect_url: str = "",
    password: str = "",
) -> tuple[Client, str]:
    client = create_client(supabase_url, supabase_anon_key)
    session = None if force_login else _load_session(session_path)

    if session and not force_login:
        try:
            stored = sync_client_session(
                client,
                session_path,
                allow_refresh=True,
                fallback_email=session.get("email", ""),
                fallback_user_id=session.get("user_id", ""),
            )
            return client, stored["user_id"]
        except AuthError:
            print(f"Saved Supabase session expired or invalid. Sign in again, or {LOGIN_HINT}")

    login_email = _normalize_email(email or (session or {}).get("email", ""))
    env_password = password or os.getenv("IMPORT_USER_PASSWORD", "").strip()

    if not login_email and not env_password:
        login_email = _normalize_email(input("Supabase login email: "))
    session = login_interactive(
        client,
        login_email,
        auth_redirect_url=auth_redirect_url,
        password=env_password,
    )
    client.auth.set_session(session["access_token"], session["refresh_token"])
    _save_session(session_path, session)
    print(f"Signed in as {session['email']} ({session['user_id']})")
    return client, session["user_id"]


class ImportAuth:
    def __init__(
        self,
        *,
        supabase_url: str,
        supabase_anon_key: str,
        session_path: Path,
        auth_redirect_url: str = "",
        import_user_email: str = "",
        import_user_password: str = "",
        force_login: bool = False,
    ):
        self.supabase_url = supabase_url
        self.supabase_anon_key = supabase_anon_key
        self.session_path = session_path
        self.auth_redirect_url = auth_redirect_url
        self.import_user_email = import_user_email
        self.import_user_password = import_user_password
        self.client: Client | None = None
        self.contributor_id = ""
        self.connect(force_login=force_login)

    def connect(self, *, force_login: bool = False) -> None:
        self.client, self.contributor_id = ensure_authenticated_client(
            self.supabase_url,
            self.supabase_anon_key,
            self.session_path,
            force_login=force_login,
            email=self.import_user_email,
            auth_redirect_url=self.auth_redirect_url,
            password=self.import_user_password,
        )

    def sync_session(self, *, allow_refresh: bool = False) -> None:
        if self.client is None:
            raise AuthError("Supabase client is not connected.")
        stored = sync_client_session(
            self.client,
            self.session_path,
            allow_refresh=allow_refresh,
            fallback_email=self.import_user_email,
            fallback_user_id=self.contributor_id,
        )
        self.contributor_id = stored["user_id"]

    def refresh(self) -> None:
        self.sync_session(allow_refresh=True)

    def relogin(self) -> None:
        print("\nSupabase session expired. Please sign in again.")
        self.connect(force_login=True)

    def run(self, action: Callable[[], Any]) -> Any:
        if self.client is None:
            raise AuthError("Supabase client is not connected.")

        try:
            self.sync_session(allow_refresh=True)
        except AuthError:
            self.relogin()

        try:
            result = action()
            persist_client_session(
                self.client,
                self.session_path,
                fallback_email=self.import_user_email,
                fallback_user_id=self.contributor_id,
            )
            return result
        except Exception as error:
            if not is_auth_error(error):
                raise

            try:
                self.sync_session(allow_refresh=True)
                result = action()
                persist_client_session(
                    self.client,
                    self.session_path,
                    fallback_email=self.import_user_email,
                    fallback_user_id=self.contributor_id,
                )
                return result
            except AuthError:
                self.relogin()
                result = action()
                persist_client_session(
                    self.client,
                    self.session_path,
                    fallback_email=self.import_user_email,
                    fallback_user_id=self.contributor_id,
                )
                return result
