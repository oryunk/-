"""Google Sign-In (사용자 웹 로그인). KIS /oauth2/tokenP(서버 API 토큰)과 별개."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from urllib.parse import urlencode

import pymysql.err
import requests
from flask import Blueprint, jsonify, redirect, request, session

from auth_login_id import migrate_google_login_id_if_needed, unique_login_id_from_email
from runtime_config import flask_secret_key, google_login_success_url, google_oauth_config
from services.profile_image_service import normalize_google_picture_url

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_SCOPES = "openid email profile"
_OAUTH_STATE_TTL_SEC = 600


def _oauth_state_secret() -> str:
    return flask_secret_key()


def _generate_oauth_state() -> str:
    """세션 쿠키 없이도 검증 가능한 CSRF state (localhost/127.0.0.1 불일치 대응)."""
    nonce = secrets.token_urlsafe(16)
    ts = int(time.time())
    payload = f"{nonce}:{ts}"
    sig = hmac.new(
        _oauth_state_secret().encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{sig}"


def _verify_oauth_state(state: str, max_age_sec: int = _OAUTH_STATE_TTL_SEC) -> bool:
    if not state or state.count(":") < 2:
        return False
    try:
        payload, sig = state.rsplit(":", 1)
        _nonce, ts_str = payload.split(":", 1)
        ts = int(ts_str)
    except (TypeError, ValueError):
        return False
    if time.time() - ts > max_age_sec:
        return False
    expected = hmac.new(
        _oauth_state_secret().encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return False
    return True


def register_google_auth_routes(bp: Blueprint, *, get_connection, db_error_message) -> None:
    """auth_bp 에 Google OAuth 라우트 등록."""
    def _oauth_ready():
        return google_oauth_config()

    def _fail_redirect(reason: str = "google"):
        base = google_login_success_url()
        sep = "&" if "?" in base else "?"
        return redirect(f"{base}{sep}login_error={reason}")

    def _sanitize_nickname_chars(text: str) -> str:
        import re

        return re.sub(r"[^가-힣A-Za-z0-9]", "", text or "")[:8]

    def _nickname_exists(cursor, nickname: str) -> bool:
        cursor.execute(
            "SELECT user_id FROM users WHERE nickname = %s LIMIT 1",
            (nickname,),
        )
        return cursor.fetchone() is not None

    def _nickname_from_profile(name: str, email: str, login_id: str, cursor) -> str:
        from auth_api import _validate_nickname

        local = (email or "").split("@")[0].strip()
        candidates = [
            _sanitize_nickname_chars(name),
            _sanitize_nickname_chars(local),
            _sanitize_nickname_chars(login_id or ""),
        ]
        for cand in candidates:
            if _validate_nickname(cand) is None and not _nickname_exists(cursor, cand):
                return cand

        for i in range(1, 10000):
            suffix = str(i) if i > 1 else ""
            nick = ("주린이" + suffix)[:8]
            if _validate_nickname(nick) is None and not _nickname_exists(cursor, nick):
                return nick

        return "주린이12"

    def _store_google_picture_url(cursor, user_id: int, picture_url: str | None) -> None:
        normalized = normalize_google_picture_url(picture_url)
        if not normalized:
            return
        cursor.execute(
            """
            UPDATE users
            SET google_picture_url = %s, updated_at = NOW()
            WHERE user_id = %s
            """,
            (normalized, user_id),
        )

    def _resolve_google_user(
        cursor,
        google_sub: str,
        email: str,
        name: str,
        verified: bool,
        picture_url: str | None = None,
    ) -> int | None:
        cursor.execute(
            """
            SELECT user_id, email, password_hash, google_sub, login_id, auth_provider
            FROM users WHERE google_sub = %s LIMIT 1
            """,
            (google_sub,),
        )
        row = cursor.fetchone()
        if row:
            uid = int(row["user_id"])
            migrate_google_login_id_if_needed(
                cursor,
                uid,
                row.get("email") or email,
                row.get("login_id"),
                auth_provider=row.get("auth_provider") or "google",
            )
            _store_google_picture_url(cursor, uid, picture_url)
            return uid

        if not email:
            return None

        cursor.execute(
            """
            SELECT user_id, email, google_sub, login_id, auth_provider
            FROM users WHERE email = %s LIMIT 1
            """,
            (email,),
        )
        by_email = cursor.fetchone()
        if by_email:
            if by_email.get("google_sub") and by_email["google_sub"] != google_sub:
                return None
            if verified:
                cursor.execute(
                    """
                    UPDATE users
                    SET google_sub = %s, auth_provider = 'google', updated_at = NOW()
                    WHERE user_id = %s
                    """,
                    (google_sub, by_email["user_id"]),
                )
                uid = int(by_email["user_id"])
                migrate_google_login_id_if_needed(
                    cursor,
                    uid,
                    email,
                    by_email.get("login_id"),
                    auth_provider="google",
                )
                _store_google_picture_url(cursor, uid, picture_url)
                return uid
            return None

        login_id = unique_login_id_from_email(cursor, email)
        nickname = _nickname_from_profile(name, email, login_id, cursor)
        normalized_picture = normalize_google_picture_url(picture_url)
        cursor.execute(
            """
            INSERT INTO users (
                login_id, email, password_hash, nickname,
                google_sub, auth_provider, google_picture_url,
                created_at, updated_at
            ) VALUES (%s, %s, NULL, %s, %s, 'google', %s, NOW(), NOW())
            """,
            (login_id, email, nickname, google_sub, normalized_picture),
        )
        return int(cursor.lastrowid)

    @bp.route("/api/auth/google/status", methods=["GET"])
    def google_oauth_status():
        """OAuth 설정 진단(비밀 미노출). redirect_uri 를 Console URI 와 대조할 때 사용."""
        cfg = _oauth_ready()
        base = {
            "configured": bool(cfg),
            "login_success_url": google_login_success_url(),
            "flow": "same_tab_redirect",
            "start_path": "/api/auth/google/start",
            "callback_path": "/api/auth/google/callback",
            "link_ui": "none",
            "link_behavior": (
                "auto_link_if_same_email_and_email_verified; "
                "else_new_user_if_db_empty"
            ),
        }
        if not cfg:
            base["redirect_uri"] = None
            base["hint"] = (
                "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in backend/.env. "
                "See backend/docs/GOOGLE_OAUTH_SETUP.md"
            )
            return jsonify(base), 200

        base["redirect_uri"] = cfg["redirect_uri"]
        base["client_id"] = cfg["client_id"]
        base["hint"] = (
            "Register redirect_uri exactly in Google Cloud Console → OAuth client → "
            "Authorized redirect URIs. In Testing mode, add your Gmail as a test user."
        )
        return jsonify(base), 200

    @bp.route("/api/auth/google/start", methods=["GET"])
    def google_start():
        cfg = _oauth_ready()
        if not cfg:
            return _fail_redirect("google_not_configured")

        state = _generate_oauth_state()
        session["google_oauth_state"] = state

        params = {
            "client_id": cfg["client_id"],
            "redirect_uri": cfg["redirect_uri"],
            "response_type": "code",
            "scope": GOOGLE_SCOPES,
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
        return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")

    @bp.route("/api/auth/google/callback", methods=["GET"])
    def google_callback():
        cfg = _oauth_ready()
        if not cfg:
            return _fail_redirect("google_not_configured")

        err = request.args.get("error")
        if err:
            return _fail_redirect(err)

        code = request.args.get("code", "")
        state = request.args.get("state", "")
        session.pop("google_oauth_state", None)
        if not code or not state or not _verify_oauth_state(state):
            return _fail_redirect("google_state")

        try:
            token_res = requests.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                    "redirect_uri": cfg["redirect_uri"],
                    "grant_type": "authorization_code",
                },
                timeout=15,
            )
            if token_res.status_code != 200:
                return _fail_redirect("google_token")
            access_token = token_res.json().get("access_token")
            if not access_token:
                return _fail_redirect("google_token")

            profile_res = requests.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15,
            )
            if profile_res.status_code != 200:
                return _fail_redirect("google_profile")
            profile = profile_res.json()
        except requests.RequestException:
            return _fail_redirect("google_network")

        google_sub = (profile.get("sub") or "").strip()
        email = (profile.get("email") or "").strip()
        name = (profile.get("name") or "").strip()
        picture = (profile.get("picture") or "").strip()
        verified = bool(profile.get("email_verified"))

        if not google_sub:
            return _fail_redirect("google_profile")

        conn = None
        try:
            conn = get_connection()
            with conn.cursor() as cursor:
                user_id = _resolve_google_user(
                    cursor,
                    google_sub,
                    email,
                    name,
                    verified,
                    picture,
                )
                if user_id is None:
                    conn.rollback()
                    return _fail_redirect("google_account")
                conn.commit()

            session.clear()
            session["user_id"] = user_id
            return redirect(google_login_success_url())

        except pymysql.err.ProgrammingError as e:
            if conn:
                conn.rollback()
            if e.args and e.args[0] == 1054:
                return _fail_redirect("google_db")
            return _fail_redirect("google")
        except Exception:
            if conn:
                conn.rollback()
            return _fail_redirect("google")
        finally:
            if conn:
                conn.close()
