"""루미콘 — 학습 가이드 보상 이모티콘."""

from __future__ import annotations

import re

from email_verification import is_missing_table_error

LUMICON_IDS = frozenset(
    {
        "happy",
        "excited",
        "curious",
        "success",
        "surprised",
        "sparkle",
        "hello",
        "struggling",
        "sleepy",
        "thinking",
    }
)

LUMICON_TOKEN_RE = re.compile(r":lumi:([a-z0-9_-]+):")


def extract_lumicon_ids(body: str) -> set[str]:
    if not body:
        return set()
    return {m.group(1) for m in LUMICON_TOKEN_RE.finditer(body) if m.group(1) in LUMICON_IDS}


def list_user_lumicon_ids(conn, user_id: int) -> list[str] | None:
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT lumicon_id
                FROM user_lumicons
                WHERE user_id = %s
                ORDER BY lumicon_id ASC
                """,
                (user_id,),
            )
            rows = cursor.fetchall() or []
        return [str(row["lumicon_id"]) for row in rows if row.get("lumicon_id") in LUMICON_IDS]
    except Exception as exc:
        if is_missing_table_error(exc):
            return None
        raise


def grant_all_lumicons(conn, user_id: int) -> list[str]:
    try:
        with conn.cursor() as cursor:
            for lumicon_id in sorted(LUMICON_IDS):
                cursor.execute(
                    """
                    INSERT IGNORE INTO user_lumicons (user_id, lumicon_id)
                    VALUES (%s, %s)
                    """,
                    (user_id, lumicon_id),
                )
        conn.commit()
        unlocked = list_user_lumicon_ids(conn, user_id)
        return unlocked or []
    except Exception as exc:
        if is_missing_table_error(exc):
            conn.rollback()
            return sorted(LUMICON_IDS)
        raise


def validate_comment_lumicons(conn, user_id: int, body: str) -> None:
    used = extract_lumicon_ids(body)
    if not used:
        return
    unlocked_list = list_user_lumicon_ids(conn, user_id)
    if unlocked_list is None:
        return
    unlocked = set(unlocked_list)
    if not unlocked:
        grant_all_lumicons(conn, user_id)
        refreshed = list_user_lumicon_ids(conn, user_id)
        unlocked = set(refreshed or [])
    if not unlocked:
        raise ValueError("lumicon_not_unlocked")
    missing = used - unlocked
    if missing:
        raise ValueError("lumicon_not_unlocked")
