"""KIS OAuth 토큰 DB 보관. token_vts.json 과 병행해 재시작·멀티 워커 시 공유."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

KIS_TOKEN_TYPE = "KIS_ACCESS_TOKEN"


def load_valid_token_row(conn) -> dict[str, Any] | None:
    """만료 전 토큰 1건 {access_token, expired_at} 또는 None."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT access_token, expired_at
                FROM api_tokens
                WHERE token_type = %s AND expired_at > NOW()
                ORDER BY token_id DESC
                LIMIT 1
                """,
                (KIS_TOKEN_TYPE,),
            )
            row = cur.fetchone()
            if not row or not row.get("access_token"):
                return None
            return dict(row)
    except Exception as e:
        err = getattr(e, "args", None)
        if err and err[0] == 1146:
            return None
        print(f"[api_tokens] 조회 실패: {e}")
        return None


def ensure_token_saved_if_absent(conn, access_token: str, ttl_seconds: int = 82800) -> bool:
    """DB에 만료 전 토큰 행이 없을 때만 저장(로컬 token_vts.json 과 맞추기)."""
    if not access_token:
        return False
    if load_valid_token_row(conn):
        return False
    save_token(conn, access_token, ttl_seconds)
    return True


def save_token(conn, access_token: str, ttl_seconds: int = 82800) -> None:
    """새 토큰 저장(만료는 넉넉히; 실제 갱신은 앱 로직이 주도). 오래된 행 정리."""
    exp = datetime.now() + timedelta(seconds=min(max(ttl_seconds, 3600), 86400))
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO api_tokens (token_type, access_token, expired_at)
            VALUES (%s, %s, %s)
            """,
            (KIS_TOKEN_TYPE, access_token, exp),
        )
        cur.execute(
            """
            DELETE FROM api_tokens
            WHERE token_type = %s AND expired_at < NOW()
            """,
            (KIS_TOKEN_TYPE,),
        )
