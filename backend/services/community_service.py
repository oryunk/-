"""커뮤니티 게시글 — 목록·상세·작성."""

from __future__ import annotations

import json
import math
import os
import shutil
import uuid
from datetime import datetime
from typing import Any

from werkzeug.utils import secure_filename

from services.profile_image_service import author_row_avatar_url, author_row_nickname
from services.lumicon_service import validate_comment_lumicons

BOARDS: dict[str, str] = {
    "free": "일반",
    "qna": "질문/답변",
}

BOARD_KEYS = frozenset(BOARDS.keys())

# 일반 필터: free + 예전 seed(stock, proof)
GENERAL_BOARDS = ("free", "stock", "proof")

# 예전 seed/데이터(stock, proof 등)는 화면에서 일반으로 표시
_LEGACY_BOARD_LABELS: dict[str, str] = {
    "stock": "일반",
    "proof": "일반",
}

ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
ALLOWED_ATTACHMENT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_ATTACHMENT_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

POLL_MIN_OPTIONS = 2
POLL_MAX_OPTIONS = 5
POLL_ICON_TYPES = frozenset({"rise", "fall", "custom"})
POLL_LABEL_MAX_LEN = 50
POLL_TITLE_MAX_LEN = 100
POLL_DEFAULT_TITLE = "여러분의 생각은?"


def _attachment_upload_root() -> str:
    root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "uploads", "community_posts")
    )
    os.makedirs(root, exist_ok=True)
    return root


def _serialize_attachment(post_id: int, row: dict) -> dict:
    attachment_id = int(row["attachment_id"])
    return {
        "attachmentId": attachment_id,
        "originalName": row.get("original_name") or "",
        "mimeType": row.get("mime_type") or "",
        "fileSize": int(row.get("file_size") or 0),
        "url": f"/api/community/posts/{post_id}/attachments/{attachment_id}",
    }


def _fetch_attachments(cursor, post_id: int) -> list[dict]:
    cursor.execute(
        """
        SELECT attachment_id, original_name, mime_type, file_size
        FROM community_post_attachments
        WHERE post_id = %s
        ORDER BY attachment_id ASC
        LIMIT 1
        """,
        (post_id,),
    )
    rows = cursor.fetchall() or []
    return [_serialize_attachment(post_id, row) for row in rows]


def _save_post_attachment(cursor, post_id: int, file_storage) -> dict:
    if file_storage is None or not getattr(file_storage, "filename", None):
        raise ValueError("invalid_attachment")

    cursor.execute(
        "SELECT COUNT(*) AS cnt FROM community_post_attachments WHERE post_id = %s",
        (post_id,),
    )
    count_row = cursor.fetchone() or {}
    if int(count_row.get("cnt") or 0) >= 1:
        raise ValueError("attachment_limit")

    original_name = (file_storage.filename or "").strip()
    if not original_name:
        raise ValueError("invalid_attachment")

    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise ValueError("invalid_attachment_type")

    file_storage.seek(0, os.SEEK_END)
    size = int(file_storage.tell())
    file_storage.seek(0)
    if size <= 0:
        raise ValueError("invalid_attachment")
    if size > ATTACHMENT_MAX_BYTES:
        raise ValueError("attachment_too_large")

    mime_type = (file_storage.mimetype or "").split(";", 1)[0].strip().lower()
    if mime_type not in ALLOWED_ATTACHMENT_MIME_TYPES:
        raise ValueError("invalid_attachment_type")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = os.path.join(_attachment_upload_root(), str(post_id))
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, stored_name)
    file_storage.save(dest_path)

    safe_original = secure_filename(original_name) or f"image{ext}"
    cursor.execute(
        """
        INSERT INTO community_post_attachments
          (post_id, original_name, stored_name, mime_type, file_size)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (post_id, safe_original, stored_name, mime_type, size),
    )
    attachment_id = int(cursor.lastrowid)
    return _serialize_attachment(
        post_id,
        {
            "attachment_id": attachment_id,
            "original_name": safe_original,
            "mime_type": mime_type,
            "file_size": size,
        },
    )


def get_attachment_file(conn, post_id: int, attachment_id: int) -> dict | None:
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT post_id FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        if not cursor.fetchone():
            return None

        cursor.execute(
            """
            SELECT attachment_id, original_name, stored_name, mime_type
            FROM community_post_attachments
            WHERE post_id = %s AND attachment_id = %s
            LIMIT 1
            """,
            (post_id, attachment_id),
        )
        row = cursor.fetchone()
        if not row:
            return None

    path = os.path.join(
        _attachment_upload_root(),
        str(post_id),
        row["stored_name"],
    )
    if not os.path.isfile(path):
        return None

    return {
        "path": path,
        "mime_type": row.get("mime_type") or "application/octet-stream",
        "original_name": row.get("original_name") or "attachment",
    }


def _remove_post_upload_dir(post_id: int) -> None:
    path = os.path.join(_attachment_upload_root(), str(post_id))
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)


def _remove_post_attachments(cursor, post_id: int) -> None:
    cursor.execute(
        """
        SELECT stored_name
        FROM community_post_attachments
        WHERE post_id = %s
        """,
        (post_id,),
    )
    rows = cursor.fetchall() or []
    if not rows:
        return
    cursor.execute(
        "DELETE FROM community_post_attachments WHERE post_id = %s",
        (post_id,),
    )
    dest_dir = os.path.join(_attachment_upload_root(), str(post_id))
    for row in rows:
        stored = (row.get("stored_name") or "").strip()
        if not stored:
            continue
        path = os.path.join(dest_dir, stored)
        if os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass


def _remove_post_poll(cursor, post_id: int) -> None:
    cursor.execute(
        """
        SELECT poll_id
        FROM community_post_polls
        WHERE post_id = %s
        LIMIT 1
        """,
        (post_id,),
    )
    row = cursor.fetchone()
    if not row:
        return
    poll_id = int(row["poll_id"])
    cursor.execute("DELETE FROM community_poll_votes WHERE poll_id = %s", (poll_id,))
    cursor.execute("DELETE FROM community_poll_options WHERE poll_id = %s", (poll_id,))
    cursor.execute("DELETE FROM community_post_polls WHERE poll_id = %s", (poll_id,))


def _attach_list_attachments(conn, items: list[dict]) -> list[dict]:
    if not items:
        return items
    post_ids = [int(item["postId"]) for item in items]
    placeholders = ", ".join(["%s"] * len(post_ids))
    by_post: dict[int, dict] = {}
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT post_id, attachment_id, original_name, mime_type, file_size
                FROM community_post_attachments
                WHERE post_id IN ({placeholders})
                ORDER BY post_id ASC, attachment_id ASC
                """,
                post_ids,
            )
            for row in cursor.fetchall() or []:
                post_id = int(row["post_id"])
                if post_id not in by_post:
                    by_post[post_id] = _serialize_attachment(post_id, row)
    except Exception:
        return items
    for item in items:
        attachment = by_post.get(int(item["postId"]))
        item["attachments"] = [attachment] if attachment else []
    return items


def _attach_post_attachments(conn, item: dict) -> dict:
    post_id = int(item["postId"])
    try:
        with conn.cursor() as cursor:
            item["attachments"] = _fetch_attachments(cursor, post_id)
    except Exception:
        item["attachments"] = []
    return item


def _parse_poll_enabled(value) -> bool:
    if value is True:
        return True
    if value is False or value is None:
        return False
    if isinstance(value, (int, float)):
        return int(value) == 1
    text = str(value).strip().lower()
    return text in ("1", "true", "yes", "on")


def _parse_poll_ends_at(value: str | None) -> datetime:
    raw = (value or "").strip()
    if not raw:
        raise ValueError("invalid_poll_ends_at")
    normalized = raw.replace("Z", "+00:00")
    if " " in normalized and "T" not in normalized:
        normalized = normalized.replace(" ", "T", 1)
    if normalized.count(":") == 1:
        normalized += ":00"
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        raise ValueError("invalid_poll_ends_at") from None
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    if dt <= datetime.now():
        raise ValueError("invalid_poll_ends_at")
    return dt


def _parse_poll_title(value: str | None) -> str:
    title = (value or "").strip()
    if not title:
        raise ValueError("invalid_poll_title")
    if len(title) > POLL_TITLE_MAX_LEN:
        raise ValueError("invalid_poll_title")
    return title


def _parse_poll_options(raw) -> list[dict]:
    if raw is None:
        return []
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        try:
            raw = json.loads(text)
        except json.JSONDecodeError:
            raise ValueError("invalid_poll_options") from None
    if not isinstance(raw, list):
        raise ValueError("invalid_poll_options")

    options: list[dict] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("invalid_poll_options")
        label = (item.get("label") or "").strip()
        if not label or len(label) > POLL_LABEL_MAX_LEN:
            raise ValueError("invalid_poll_options")
        key = label.casefold()
        if key in seen:
            raise ValueError("duplicate_poll_option")
        seen.add(key)
        icon_type = (item.get("iconType") or item.get("icon_type") or "custom").strip().lower()
        if icon_type not in POLL_ICON_TYPES:
            icon_type = "custom"
        options.append({"label": label, "iconType": icon_type})

    if len(options) < POLL_MIN_OPTIONS:
        raise ValueError("too_few_poll_options")
    if len(options) > POLL_MAX_OPTIONS:
        raise ValueError("too_many_poll_options")
    return options


def _option_percentages(counts: list[int]) -> list[int]:
    total = sum(counts)
    if total <= 0:
        return [0 for _ in counts]
    percents: list[int] = []
    allocated = 0
    for idx, count in enumerate(counts):
        if idx == len(counts) - 1:
            percents.append(max(0, 100 - allocated))
        else:
            pct = round(count * 100 / total)
            percents.append(pct)
            allocated += pct
    return percents


def _serialize_poll(
    poll_row: dict,
    *,
    option_rows: list[dict],
    vote_counts: dict[int, int],
    my_vote_option_id: int | None = None,
    now: datetime | None = None,
) -> dict:
    ends_at = poll_row.get("ends_at")
    if now is None:
        now = datetime.now()
    is_closed = bool(ends_at and ends_at <= now)
    counts = [int(vote_counts.get(int(row["option_id"]), 0)) for row in option_rows]
    total_votes = sum(counts)
    percents = _option_percentages(counts)
    options = []
    for idx, row in enumerate(option_rows):
        option_id = int(row["option_id"])
        options.append(
            {
                "optionId": option_id,
                "label": row.get("label") or "",
                "iconType": row.get("icon_type") or "custom",
                "voteCount": counts[idx],
                "percent": percents[idx],
            }
        )
    return {
        "pollId": int(poll_row["poll_id"]),
        "title": (poll_row.get("title") or "").strip() or POLL_DEFAULT_TITLE,
        "endsAt": ends_at.isoformat(sep=" ", timespec="seconds") if ends_at else None,
        "isClosed": is_closed,
        "totalVotes": total_votes,
        "myVoteOptionId": my_vote_option_id,
        "options": options,
    }


def _fetch_poll_option_rows(cursor, poll_ids: list[int]) -> dict[int, list[dict]]:
    if not poll_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(poll_ids))
    cursor.execute(
        f"""
        SELECT option_id, poll_id, label, icon_type, sort_order
        FROM community_poll_options
        WHERE poll_id IN ({placeholders})
        ORDER BY poll_id ASC, sort_order ASC, option_id ASC
        """,
        poll_ids,
    )
    by_poll: dict[int, list[dict]] = {}
    for row in cursor.fetchall() or []:
        poll_id = int(row["poll_id"])
        by_poll.setdefault(poll_id, []).append(row)
    return by_poll


def _poll_option_vote_counts(cursor, poll_ids: list[int]) -> dict[int, dict[int, int]]:
    if not poll_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(poll_ids))
    cursor.execute(
        f"""
        SELECT v.poll_id, v.option_id, COUNT(*) AS cnt
        FROM community_poll_votes v
        WHERE v.poll_id IN ({placeholders})
        GROUP BY v.poll_id, v.option_id
        """,
        poll_ids,
    )
    counts: dict[int, dict[int, int]] = {}
    for row in cursor.fetchall() or []:
        poll_id = int(row["poll_id"])
        option_id = int(row["option_id"])
        bucket = counts.setdefault(poll_id, {})
        bucket[option_id] = int(row.get("cnt") or 0)
    return counts


def _poll_my_vote_option_ids(
    cursor,
    poll_ids: list[int],
    session_user_id: int | None,
) -> dict[int, int]:
    if not poll_ids or session_user_id is None:
        return {}
    placeholders = ", ".join(["%s"] * len(poll_ids))
    cursor.execute(
        f"""
        SELECT poll_id, option_id
        FROM community_poll_votes
        WHERE poll_id IN ({placeholders}) AND user_id = %s
        """,
        poll_ids + [session_user_id],
    )
    return {int(row["poll_id"]): int(row["option_id"]) for row in cursor.fetchall() or []}


def _build_poll_payload(
    poll_row: dict,
    *,
    option_rows: list[dict],
    vote_counts: dict[int, int],
    my_vote_option_id: int | None = None,
) -> dict:
    return _serialize_poll(
        poll_row,
        option_rows=option_rows,
        vote_counts=vote_counts,
        my_vote_option_id=my_vote_option_id,
    )


def _fetch_poll_for_post(
    conn,
    post_id: int,
    *,
    session_user_id: int | None = None,
) -> dict | None:
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT poll_id, post_id, title, ends_at, created_at
                FROM community_post_polls
                WHERE post_id = %s
                LIMIT 1
                """,
                (post_id,),
            )
            poll_row = cursor.fetchone()
            if not poll_row:
                return None
            poll_id = int(poll_row["poll_id"])
            option_rows = _fetch_poll_option_rows(cursor, [poll_id]).get(poll_id, [])
            counts_by_poll = _poll_option_vote_counts(cursor, [poll_id])
            my_votes = _poll_my_vote_option_ids(cursor, [poll_id], session_user_id)
            return _build_poll_payload(
                poll_row,
                option_rows=option_rows,
                vote_counts=counts_by_poll.get(poll_id, {}),
                my_vote_option_id=my_votes.get(poll_id),
            )
    except Exception:
        return None


def _attach_list_polls(
    conn,
    items: list[dict],
    *,
    session_user_id: int | None = None,
) -> list[dict]:
    if not items:
        return items
    post_ids = [int(item["postId"]) for item in items]
    placeholders = ", ".join(["%s"] * len(post_ids))
    polls_by_post: dict[int, dict] = {}
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT poll_id, post_id, title, ends_at, created_at
                FROM community_post_polls
                WHERE post_id IN ({placeholders})
                """,
                post_ids,
            )
            poll_rows = cursor.fetchall() or []
            poll_ids = [int(row["poll_id"]) for row in poll_rows]
            options_by_poll = _fetch_poll_option_rows(cursor, poll_ids)
            counts_by_poll = _poll_option_vote_counts(cursor, poll_ids)
            my_votes = _poll_my_vote_option_ids(cursor, poll_ids, session_user_id)
            for row in poll_rows:
                poll_id = int(row["poll_id"])
                post_id = int(row["post_id"])
                polls_by_post[post_id] = _build_poll_payload(
                    row,
                    option_rows=options_by_poll.get(poll_id, []),
                    vote_counts=counts_by_poll.get(poll_id, {}),
                    my_vote_option_id=my_votes.get(poll_id),
                )
    except Exception:
        for item in items:
            item["poll"] = None
        return items
    for item in items:
        item["poll"] = polls_by_post.get(int(item["postId"]))
    return items


def _attach_post_poll(
    conn,
    item: dict,
    *,
    session_user_id: int | None = None,
) -> dict:
    item["poll"] = _fetch_poll_for_post(conn, int(item["postId"]), session_user_id=session_user_id)
    return item


def _save_post_poll(cursor, post_id: int, ends_at: datetime, title: str) -> int:
    cursor.execute(
        """
        INSERT INTO community_post_polls (post_id, title, ends_at)
        VALUES (%s, %s, %s)
        """,
        (post_id, title, ends_at),
    )
    return int(cursor.lastrowid)


def _save_post_poll_options(cursor, poll_id: int, options: list[dict]) -> None:
    for idx, option in enumerate(options):
        cursor.execute(
            """
            INSERT INTO community_poll_options (poll_id, label, icon_type, sort_order)
            VALUES (%s, %s, %s, %s)
            """,
            (poll_id, option["label"], option["iconType"], idx),
        )


def vote_poll(
    conn,
    post_id: int,
    user_id: int,
    option_id: int,
) -> dict | None:
    option_id = int(option_id)
    if option_id <= 0:
        raise ValueError("invalid_choice")

    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT post_id FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        if not cursor.fetchone():
            return None

        cursor.execute(
            """
            SELECT poll_id, ends_at
            FROM community_post_polls
            WHERE post_id = %s
            LIMIT 1
            """,
            (post_id,),
        )
        poll_row = cursor.fetchone()
        if not poll_row:
            raise LookupError("poll_not_found")

        poll_id = int(poll_row["poll_id"])
        ends_at = poll_row.get("ends_at")
        if ends_at and ends_at <= datetime.now():
            raise ValueError("poll_closed")

        cursor.execute(
            """
            SELECT option_id
            FROM community_poll_options
            WHERE poll_id = %s AND option_id = %s
            LIMIT 1
            """,
            (poll_id, option_id),
        )
        if not cursor.fetchone():
            raise ValueError("invalid_choice")

        cursor.execute(
            """
            SELECT option_id
            FROM community_poll_votes
            WHERE poll_id = %s AND user_id = %s
            LIMIT 1
            """,
            (poll_id, user_id),
        )
        existing_vote = cursor.fetchone()
        if existing_vote:
            existing_option_id = int(existing_vote["option_id"])
            if existing_option_id != option_id:
                cursor.execute(
                    """
                    UPDATE community_poll_votes
                    SET option_id = %s
                    WHERE poll_id = %s AND user_id = %s
                    """,
                    (option_id, poll_id, user_id),
                )
        else:
            cursor.execute(
                """
                INSERT INTO community_poll_votes (poll_id, user_id, option_id)
                VALUES (%s, %s, %s)
                """,
                (poll_id, user_id, option_id),
            )

    conn.commit()
    poll = _fetch_poll_for_post(conn, post_id, session_user_id=user_id)
    if not poll:
        raise RuntimeError("vote_failed")
    return poll


def _normalize_stock_code(code: str | None) -> str | None:
    code = (code or "").strip()
    if not code:
        return None
    if code.isdigit():
        return code.zfill(6)
    return code


def _normalize_board_filter(board: str | None) -> str | None:
    key = (board or "").strip().lower()
    if not key or key == "all":
        return None
    if key in ("popular", "free", "qna"):
        return key
    return None


def _board_label(board: str | None) -> str:
    key = (board or "free").strip()
    if key in BOARDS:
        return BOARDS[key]
    return _LEGACY_BOARD_LABELS.get(key, "일반")

SORT_OPTIONS = frozenset({"latest", "likes", "comments"})

_COMMENT_COUNT_SQL = (
    "(SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = p.post_id)"
)


def _liked_by_me_select(session_user_id: int | None) -> tuple[str, list[Any]]:
    if session_user_id is None:
        return ", 0 AS liked_by_me", []
    return (
        ", EXISTS("
        "SELECT 1 FROM community_post_likes pl "
        "WHERE pl.post_id = p.post_id AND pl.user_id = %s"
        ") AS liked_by_me",
        [session_user_id],
    )


def _sync_post_comment_count(cursor, post_id: int) -> None:
    cursor.execute(
        """
        UPDATE community_posts
        SET comment_count = (
          SELECT COUNT(*) FROM community_comments c WHERE c.post_id = %s
        )
        WHERE post_id = %s
        """,
        (post_id, post_id),
    )


def _serialize_row(row: dict, *, include_body: bool = False, session_user_id: int | None = None) -> dict:
    board = row.get("board") or "free"
    owner_id = int(row["user_id"])
    item = {
        "postId": int(row["post_id"]),
        "userId": owner_id,
        "board": board,
        "boardLabel": _board_label(board),
        "title": row.get("title") or "",
        "authorNickname": author_row_nickname(row),
        "authorAvatarUrl": author_row_avatar_url(row),
        "stockCode": (row.get("stock_code") or "").strip() or None,
        "stockName": (row.get("stock_name") or "").strip() or None,
        "viewCount": int(row.get("view_count") or 0),
        "likeCount": int(row.get("like_count") or 0),
        "commentCount": int(row.get("comment_count") or 0),
        "createdAt": row["created_at"].isoformat(sep=" ", timespec="seconds")
        if row.get("created_at")
        else None,
        "updatedAt": row["updated_at"].isoformat(sep=" ", timespec="seconds")
        if row.get("updated_at")
        else None,
        "isOwner": session_user_id is not None and int(session_user_id) == owner_id,
    }
    if session_user_id is not None:
        item["likedByMe"] = bool(row.get("liked_by_me"))
    if include_body:
        item["body"] = row.get("body") or ""
    else:
        item["bodyPreview"] = (row.get("body") or "")[:200]
    return item


def get_meta_payload() -> dict[str, Any]:
    boards = [{"id": k, "label": v} for k, v in BOARDS.items()]
    sidebar = [
        {"id": "all", "label": "전체 게시글"},
        {"id": "popular", "label": "인기글"},
        {"id": "free", "label": "일반"},
        {"id": "qna", "label": "질문/답변"},
    ]
    return {"boards": boards, "sidebar": sidebar}


def _stock_filter_clause(
    stock_code: str | None,
    stock_name: str | None,
) -> tuple[str | None, list[Any]]:
    """종목 태그 클릭 시 — 코드/이름에 맞는 글을 전부(페이지 단위) 반환."""
    code = _normalize_stock_code(stock_code)
    name = (stock_name or "").strip() or None
    parts: list[str] = []
    params: list[Any] = []

    if code:
        parts.append(
            "(LPAD(TRIM(COALESCE(p.stock_code, '')), 6, '0') = %s "
            "OR TRIM(COALESCE(p.stock_code, '')) = %s)"
        )
        bare = code.lstrip("0") or "0"
        params.extend([code, bare])
        if name:
            parts.append(
                "(TRIM(COALESCE(p.stock_name, '')) = %s "
                "AND NULLIF(TRIM(COALESCE(p.stock_code, '')), '') IS NULL)"
            )
            params.append(name)
        if len(parts) == 1:
            return parts[0], params
        return "(" + " OR ".join(parts) + ")", params

    if name:
        return "TRIM(COALESCE(p.stock_name, '')) = %s", [name]

    return None, []


def _list_where(
    *,
    board: str | None,
    q: str | None,
    stock_code: str | None = None,
    stock_name: str | None = None,
    popular_recent: bool = False,
) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []

    if popular_recent:
        clauses.append("p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)")

    if board == "free":
        placeholders = ", ".join(["%s"] * len(GENERAL_BOARDS))
        clauses.append(f"p.board IN ({placeholders})")
        params.extend(GENERAL_BOARDS)
    elif board == "qna":
        clauses.append("p.board = %s")
        params.append("qna")

    stock_sql, stock_params = _stock_filter_clause(stock_code, stock_name)
    if stock_sql:
        clauses.append(stock_sql)
        params.extend(stock_params)

    if q:
        like = f"%{q.strip()}%"
        clauses.append("(p.title LIKE %s OR p.body LIKE %s)")
        params.extend([like, like])

    where_sql = " AND ".join(clauses) if clauses else "1=1"
    return where_sql, params


def _order_sql(sort: str) -> str:
    if sort == "likes":
        return "p.like_count DESC, p.created_at DESC, p.post_id DESC"
    if sort == "comments":
        return f"{_COMMENT_COUNT_SQL} DESC, p.created_at DESC, p.post_id DESC"
    return "p.created_at DESC, p.post_id DESC"


def list_posts(
    conn,
    *,
    board: str | None = None,
    q: str | None = None,
    stock_code: str | None = None,
    stock_name: str | None = None,
    sort: str = "latest",
    page: int = 1,
    page_size: int = 10,
    session_user_id: int | None = None,
) -> dict[str, Any]:
    sort = sort if sort in SORT_OPTIONS else "latest"
    board_key = _normalize_board_filter(board)
    stock_filter = _normalize_stock_code(stock_code)
    stock_name_filter = (stock_name or "").strip() or None

    actual_board = None
    popular_recent = False
    if board_key == "popular":
        sort = "likes"
        popular_recent = True
        page = 1
        page_size = min(page_size, 5)
    elif board_key in ("free", "qna"):
        actual_board = board_key

    where_sql, params = _list_where(
        board=actual_board,
        q=q,
        stock_code=stock_filter,
        stock_name=stock_name_filter,
        popular_recent=popular_recent,
    )
    order_sql = _order_sql(sort)

    page = max(1, page)
    page_size = max(1, min(page_size, 50))
    offset = (page - 1) * page_size
    liked_sel, liked_params = _liked_by_me_select(session_user_id)

    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS cnt
            FROM community_posts p
            WHERE {where_sql}
            """,
            params,
        )
        total = int((cursor.fetchone() or {}).get("cnt") or 0)

        cursor.execute(
            f"""
            SELECT p.post_id, p.user_id, p.board, p.title, p.body,
                   p.stock_code, p.stock_name,
                   p.view_count, p.like_count,
                   {_COMMENT_COUNT_SQL} AS comment_count,
                   p.created_at, p.updated_at,
                   u.nickname AS author_nickname, u.login_id AS author_login_id,
                   u.profile_image_path AS author_profile_image_path,
                   u.google_picture_url AS author_google_picture_url
                   {liked_sel}
            FROM community_posts p
            JOIN users u ON u.user_id = p.user_id
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT %s OFFSET %s
            """,
            liked_params + params + [page_size, offset],
        )
        rows = cursor.fetchall() or []

    items = [_serialize_row(row, session_user_id=session_user_id) for row in rows]
    items = _attach_list_attachments(conn, items)
    items = _attach_list_polls(conn, items, session_user_id=session_user_id)
    total_pages = max(1, math.ceil(total / page_size)) if total else 1

    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": total_pages,
    }


def list_popular_posts(conn, *, limit: int = 5) -> list[dict]:
    limit = max(1, min(limit, 20))
    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT p.post_id, p.user_id, p.board, p.title, p.body,
                   p.stock_code, p.stock_name,
                   p.view_count, p.like_count,
                   {_COMMENT_COUNT_SQL} AS comment_count,
                   p.created_at, p.updated_at,
                   u.nickname AS author_nickname, u.login_id AS author_login_id,
                   u.profile_image_path AS author_profile_image_path,
                   u.google_picture_url AS author_google_picture_url
            FROM community_posts p
            JOIN users u ON u.user_id = p.user_id
            WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY p.like_count DESC, p.view_count DESC, p.created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall() or []
    return [_serialize_row(row) for row in rows]


def get_post(conn, post_id: int, *, session_user_id: int | None = None, increment_view: bool = True) -> dict | None:
    liked_sel, liked_params = _liked_by_me_select(session_user_id)
    with conn.cursor() as cursor:
        if increment_view:
            cursor.execute(
                "UPDATE community_posts SET view_count = view_count + 1 WHERE post_id = %s",
                (post_id,),
            )
            conn.commit()
        cursor.execute(
            f"""
            SELECT p.post_id, p.user_id, p.board, p.title, p.body,
                   p.stock_code, p.stock_name,
                   p.view_count, p.like_count,
                   {_COMMENT_COUNT_SQL} AS comment_count,
                   p.created_at, p.updated_at,
                   u.nickname AS author_nickname, u.login_id AS author_login_id,
                   u.profile_image_path AS author_profile_image_path,
                   u.google_picture_url AS author_google_picture_url
                   {liked_sel}
            FROM community_posts p
            JOIN users u ON u.user_id = p.user_id
            WHERE p.post_id = %s
            LIMIT 1
            """,
            liked_params + [post_id],
        )
        row = cursor.fetchone()
        if not row:
            return None
    item = _serialize_row(row, include_body=True, session_user_id=session_user_id)
    item = _attach_post_attachments(conn, item)
    return _attach_post_poll(conn, item, session_user_id=session_user_id)


def create_post(
    conn,
    *,
    user_id: int,
    board: str,
    title: str,
    body: str,
    stock_code: str | None = None,
    stock_name: str | None = None,
    attachment_file=None,
    poll_enabled: bool = False,
    poll_ends_at: str | None = None,
    poll_title: str | None = None,
    poll_options: list[dict] | None = None,
) -> dict:
    board = (board or "").strip()
    if board not in BOARD_KEYS:
        raise ValueError("invalid_board")

    title = (title or "").strip()
    body = (body or "").strip()
    if not title or len(title) > 200:
        raise ValueError("invalid_title")
    if not body or len(body) < 2:
        raise ValueError("invalid_body")

    stock_code = _normalize_stock_code(stock_code)
    stock_name = (stock_name or "").strip() or None
    if stock_code and len(stock_code) > 6:
        raise ValueError("invalid_stock_code")
    if stock_name and not stock_code:
        raise ValueError("invalid_stock_name")

    poll_enabled = _parse_poll_enabled(poll_enabled)
    parsed_poll_options: list[dict] = []
    parsed_poll_title = ""
    if poll_enabled:
        poll_ends_dt = _parse_poll_ends_at(poll_ends_at)
        parsed_poll_title = _parse_poll_title(poll_title)
        parsed_poll_options = _parse_poll_options(poll_options)
    else:
        poll_ends_dt = None

    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO community_posts
              (user_id, board, title, body, stock_code, stock_name)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (user_id, board, title, body, stock_code, stock_name),
        )
        post_id = int(cursor.lastrowid)
        if attachment_file is not None:
            _save_post_attachment(cursor, post_id, attachment_file)
        if poll_enabled and poll_ends_dt is not None:
            poll_id = _save_post_poll(cursor, post_id, poll_ends_dt, parsed_poll_title)
            _save_post_poll_options(cursor, poll_id, parsed_poll_options)
    conn.commit()

    item = get_post(conn, post_id, session_user_id=user_id, increment_view=False)
    if not item:
        raise RuntimeError("create_failed")
    return item


def like_post(conn, post_id: int, user_id: int) -> dict | None:
    """추천 토글 — 이미 추천한 글이면 취소."""
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT post_id FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        if not cursor.fetchone():
            return None

        cursor.execute(
            """
            SELECT 1 AS ok
            FROM community_post_likes
            WHERE post_id = %s AND user_id = %s
            LIMIT 1
            """,
            (post_id, user_id),
        )
        already = bool(cursor.fetchone())

        if already:
            cursor.execute(
                """
                DELETE FROM community_post_likes
                WHERE post_id = %s AND user_id = %s
                """,
                (post_id, user_id),
            )
            cursor.execute(
                """
                UPDATE community_posts
                SET like_count = GREATEST(like_count - 1, 0)
                WHERE post_id = %s
                """,
                (post_id,),
            )
            liked = False
        else:
            cursor.execute(
                """
                INSERT INTO community_post_likes (post_id, user_id)
                VALUES (%s, %s)
                """,
                (post_id, user_id),
            )
            cursor.execute(
                """
                UPDATE community_posts
                SET like_count = like_count + 1
                WHERE post_id = %s
                """,
                (post_id,),
            )
            liked = True

        cursor.execute(
            "SELECT like_count FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        row = cursor.fetchone()
    conn.commit()
    if not row:
        return None
    like_count = int(row.get("like_count") or 0)
    return {
        "postId": post_id,
        "likeCount": like_count,
        "liked": liked,
        "likedByMe": liked,
    }


def update_post(
    conn,
    *,
    post_id: int,
    user_id: int,
    board: str,
    title: str,
    body: str,
    stock_code: str | None = None,
    stock_name: str | None = None,
    attachment_file=None,
    remove_attachment: bool = False,
    remove_poll: bool = False,
) -> dict | None:
    board = (board or "").strip()
    if board not in BOARD_KEYS:
        raise ValueError("invalid_board")

    title = (title or "").strip()
    body = (body or "").strip()
    if not title or len(title) > 200:
        raise ValueError("invalid_title")
    if not body or len(body) < 2:
        raise ValueError("invalid_body")

    stock_code = _normalize_stock_code(stock_code)
    stock_name = (stock_name or "").strip() or None
    if stock_code and len(stock_code) > 6:
        raise ValueError("invalid_stock_code")
    if stock_name and not stock_code:
        raise ValueError("invalid_stock_name")

    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT user_id FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        if int(row["user_id"]) != int(user_id):
            raise PermissionError("forbidden")
        cursor.execute(
            """
            UPDATE community_posts
            SET board = %s, title = %s, body = %s, stock_code = %s, stock_name = %s
            WHERE post_id = %s
            """,
            (board, title, body, stock_code, stock_name, post_id),
        )
        if attachment_file is not None:
            _remove_post_attachments(cursor, post_id)
            _save_post_attachment(cursor, post_id, attachment_file)
        elif remove_attachment:
            _remove_post_attachments(cursor, post_id)
        if remove_poll:
            _remove_post_poll(cursor, post_id)
    conn.commit()

    item = get_post(conn, post_id, session_user_id=user_id, increment_view=False)
    if not item:
        raise RuntimeError("update_failed")
    return item


def delete_post(conn, *, post_id: int, user_id: int) -> bool:
    """게시글 삭제 — 댓글·추천 등 연관 데이터도 함께 제거 (FK CASCADE + 명시 삭제)."""
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT user_id FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        row = cursor.fetchone()
        if not row:
            return False
        if int(row["user_id"]) != int(user_id):
            raise PermissionError("forbidden")
        cursor.execute(
            "DELETE FROM community_post_attachments WHERE post_id = %s",
            (post_id,),
        )
        cursor.execute("DELETE FROM community_post_likes WHERE post_id = %s", (post_id,))
        cursor.execute("DELETE FROM community_comments WHERE post_id = %s", (post_id,))
        cursor.execute("DELETE FROM community_posts WHERE post_id = %s", (post_id,))
    conn.commit()
    _remove_post_upload_dir(post_id)
    return True


def _serialize_comment(row: dict, *, session_user_id: int | None = None) -> dict:
    owner_id = int(row["user_id"])
    return {
        "commentId": int(row["comment_id"]),
        "postId": int(row["post_id"]),
        "userId": owner_id,
        "authorNickname": author_row_nickname(row),
        "authorAvatarUrl": author_row_avatar_url(row),
        "body": row.get("body") or "",
        "createdAt": row["created_at"].isoformat(sep=" ", timespec="seconds")
        if row.get("created_at")
        else None,
        "isOwner": session_user_id is not None and int(session_user_id) == owner_id,
    }


def list_comments(conn, post_id: int, *, session_user_id: int | None = None) -> list[dict]:
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT post_id FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        if not cursor.fetchone():
            return None

        cursor.execute(
            """
            SELECT c.comment_id, c.post_id, c.user_id, c.body, c.created_at,
                   u.nickname AS author_nickname, u.login_id AS author_login_id,
                   u.profile_image_path AS author_profile_image_path,
                   u.google_picture_url AS author_google_picture_url
            FROM community_comments c
            JOIN users u ON u.user_id = c.user_id
            WHERE c.post_id = %s
            ORDER BY c.created_at ASC, c.comment_id ASC
            """,
            (post_id,),
        )
        rows = cursor.fetchall() or []
    return [_serialize_comment(row, session_user_id=session_user_id) for row in rows]


def create_comment(
    conn,
    *,
    post_id: int,
    user_id: int,
    body: str,
) -> dict:
    body = (body or "").strip()
    if not body or len(body) < 1:
        raise ValueError("invalid_body")
    if len(body) > 2000:
        raise ValueError("invalid_body")

    validate_comment_lumicons(conn, user_id, body)

    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT post_id FROM community_posts WHERE post_id = %s LIMIT 1",
            (post_id,),
        )
        if not cursor.fetchone():
            raise LookupError("not_found")

        cursor.execute(
            """
            INSERT INTO community_comments (post_id, user_id, body)
            VALUES (%s, %s, %s)
            """,
            (post_id, user_id, body),
        )
        comment_id = int(cursor.lastrowid)
        _sync_post_comment_count(cursor, post_id)
        cursor.execute(
            """
            SELECT c.comment_id, c.post_id, c.user_id, c.body, c.created_at,
                   u.nickname AS author_nickname, u.login_id AS author_login_id,
                   u.profile_image_path AS author_profile_image_path,
                   u.google_picture_url AS author_google_picture_url
            FROM community_comments c
            JOIN users u ON u.user_id = c.user_id
            WHERE c.comment_id = %s
            LIMIT 1
            """,
            (comment_id,),
        )
        row = cursor.fetchone()
    conn.commit()
    if not row:
        raise RuntimeError("create_failed")
    return _serialize_comment(row, session_user_id=user_id)


def update_comment(
    conn,
    *,
    comment_id: int,
    user_id: int,
    body: str,
) -> dict | None:
    body = (body or "").strip()
    if not body or len(body) > 2000:
        raise ValueError("invalid_body")

    validate_comment_lumicons(conn, user_id, body)

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.comment_id, c.user_id
            FROM community_comments c
            WHERE c.comment_id = %s
            LIMIT 1
            """,
            (comment_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        if int(row["user_id"]) != int(user_id):
            raise PermissionError("forbidden")

        cursor.execute(
            """
            UPDATE community_comments
            SET body = %s
            WHERE comment_id = %s
            """,
            (body, comment_id),
        )
        cursor.execute(
            """
            SELECT c.comment_id, c.post_id, c.user_id, c.body, c.created_at,
                   u.nickname AS author_nickname, u.login_id AS author_login_id,
                   u.profile_image_path AS author_profile_image_path,
                   u.google_picture_url AS author_google_picture_url
            FROM community_comments c
            JOIN users u ON u.user_id = c.user_id
            WHERE c.comment_id = %s
            LIMIT 1
            """,
            (comment_id,),
        )
        updated = cursor.fetchone()
    conn.commit()
    if not updated:
        return None
    return _serialize_comment(updated, session_user_id=user_id)


def delete_comment(conn, *, comment_id: int, user_id: int) -> bool:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.comment_id, c.post_id, c.user_id
            FROM community_comments c
            WHERE c.comment_id = %s
            LIMIT 1
            """,
            (comment_id,),
        )
        row = cursor.fetchone()
        if not row:
            return False
        if int(row["user_id"]) != int(user_id):
            raise PermissionError("forbidden")
        post_id = int(row["post_id"])
        cursor.execute("DELETE FROM community_comments WHERE comment_id = %s", (comment_id,))
        _sync_post_comment_count(cursor, post_id)
    conn.commit()
    return True
