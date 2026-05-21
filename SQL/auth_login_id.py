"""로그인 아이디 생성·구글 계정 이메일(local-part) 기준 정규화."""

from __future__ import annotations

import re
import secrets

LOGIN_ID_MAX = 50


def login_id_base_from_email(email: str) -> str:
    """예: dudfhr000@gmail.com → dudfhr000"""
    local = (email or "").split("@", 1)[0].strip().lower()
    base = re.sub(r"[^a-z0-9_]", "", local)
    if len(base) < 3:
        base = "user"
    return base[:LOGIN_ID_MAX]


def is_legacy_google_login_id(login_id: str | None) -> bool:
    return (login_id or "").strip().startswith("g_")


GOOGLE_ACCOUNT_FIND_ID_HELP = (
    "Google로 가입한 계정입니다. 별도 아이디 찾기는 필요 없습니다. "
    "로그인은 화면의 'Google로 로그인'을 이용해 주세요."
)

GOOGLE_ACCOUNT_HELP = (
    "Google로 가입한 계정입니다. 화면의 'Google로 로그인'을 이용해 주세요. "
    "비밀번호·계정 복구는 Google 계정 설정에서 진행하면 됩니다."
)


def is_google_only_account(user: dict | None) -> bool:
    if not user:
        return False
    if (user.get("auth_provider") or "").strip().lower() == "google":
        return True
    if user.get("google_sub") and not user.get("password_hash"):
        return True
    return False


def unique_login_id_from_email(cursor, email: str, *, exclude_user_id: int | None = None) -> str:
    base = login_id_base_from_email(email)
    if _login_id_available(cursor, base, exclude_user_id):
        return base
    for i in range(2, 1000):
        suffix = str(i)
        candidate = base[: LOGIN_ID_MAX - len(suffix)] + suffix
        if _login_id_available(cursor, candidate, exclude_user_id):
            return candidate
    return f"u_{secrets.token_hex(4)}"


def _login_id_available(cursor, login_id: str, exclude_user_id: int | None) -> bool:
    if exclude_user_id is not None:
        cursor.execute(
            "SELECT 1 FROM users WHERE login_id = %s AND user_id != %s LIMIT 1",
            (login_id, exclude_user_id),
        )
    else:
        cursor.execute("SELECT 1 FROM users WHERE login_id = %s LIMIT 1", (login_id,))
    return not cursor.fetchone()


def migrate_google_login_id_if_needed(
    cursor,
    user_id: int,
    email: str,
    current_login_id: str | None,
    *,
    auth_provider: str | None = None,
) -> str:
    """
    구글 가입 계정의 예전 g_xxx 아이디를 이메일 local-part 기준으로 바꿉니다.
    이미 다른 방식으로 정한 아이디는 유지합니다.
    """
    email = (email or "").strip()
    cur = (current_login_id or "").strip()
    if not email or not user_id:
        return cur

    provider = (auth_provider or "").strip().lower()
    is_google = provider == "google" or is_legacy_google_login_id(cur)
    if not is_google:
        return cur

    target = login_id_base_from_email(email)
    if cur == target:
        return cur

    if is_legacy_google_login_id(cur) or provider == "google":
        if _login_id_available(cursor, target, user_id):
            cursor.execute(
                "UPDATE users SET login_id = %s, updated_at = NOW() WHERE user_id = %s",
                (target, user_id),
            )
            return target
        new_id = unique_login_id_from_email(cursor, email, exclude_user_id=user_id)
        cursor.execute(
            "UPDATE users SET login_id = %s, updated_at = NOW() WHERE user_id = %s",
            (new_id, user_id),
        )
        return new_id

    return cur


def find_user_by_login_identifier(cursor, login_id: str) -> dict | None:
    """아이디, 전체 이메일, 또는 Gmail local-part(예: dudfhr000)로 조회."""
    login_id = (login_id or "").strip()
    if not login_id:
        return None

    cursor.execute(
        """
        SELECT user_id, email, login_id, password_hash, nickname, auth_provider
        FROM users
        WHERE login_id = %s OR email = %s
        LIMIT 1
        """,
        (login_id, login_id),
    )
    row = cursor.fetchone()
    if row:
        return row

    if "@" in login_id:
        return None

    needle = login_id.lower()
    cursor.execute(
        """
        SELECT user_id, email, login_id, password_hash, nickname, auth_provider
        FROM users
        WHERE LOWER(SUBSTRING_INDEX(email, '@', 1)) = %s
        LIMIT 1
        """,
        (needle,),
    )
    return cursor.fetchone()


def find_user_by_email_or_credentials(
    cursor,
    email: str,
    login_id: str = "",
) -> dict | None:
    """이메일 필수. login_id 가 있으면 일치 검사(이메일 local-part 도 허용)."""
    email = (email or "").strip()
    login_id = (login_id or "").strip()
    if not email:
        return None

    cursor.execute(
        """
        SELECT user_id, login_id, email, auth_provider, password_hash
        FROM users WHERE email = %s LIMIT 1
        """,
        (email,),
    )
    row = cursor.fetchone()
    if not row:
        return None

    if not login_id:
        return row

    stored = (row.get("login_id") or "").strip()
    local = login_id_base_from_email(email)
    if stored == login_id or login_id == email or stored == local or login_id == local:
        return row
    return None
