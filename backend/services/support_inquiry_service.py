"""문의 게시판 — 목록·상세·작성·FAQ."""

from __future__ import annotations

import os
import shutil
import uuid
from typing import Any

from werkzeug.utils import secure_filename

from services.profile_image_service import author_row_avatar_url, author_row_nickname

CATEGORIES: dict[str, str] = {
    "investment": "투자/주식",
    "service": "서비스이용",
    "account": "계정",
    "other": "기타",
}

STATUS_LABELS: dict[str, str] = {
    "waiting": "대기",
    "answered": "완료",
    "resolved": "완료",
}

FAQ_ITEMS: list[dict[str, Any]] = [
    {
        "id": 1,
        "question": "문의 답변은 얼마나 걸리나요?",
        "answer": "영업일 기준 1~2일 내 순차 답변드립니다. 주말·공휴일에는 처리가 지연될 수 있습니다.",
    },
    {
        "id": 2,
        "question": "비공개 문의는 누가 볼 수 있나요?",
        "answer": "비공개로 등록한 문의는 작성자 본인과 관리자만 확인할 수 있습니다.",
    },
    {
        "id": 3,
        "question": "모의투자와 실전 투자는 어떻게 다른가요?",
        "answer": "모의투자는 가상 자금으로 연습하는 기능입니다. 실제 주문·체결·손익과는 무관합니다.",
    },
    {
        "id": 4,
        "question": "AI 분석·차트 예측 결과를 그대로 따라해도 되나요?",
        "answer": "AI 결과는 참고용입니다. 투자 판단과 책임은 이용자 본인에게 있습니다.",
    },
    {
        "id": 5,
        "question": "회원 탈퇴는 어떻게 하나요?",
        "answer": "마이페이지 또는 고객센터 문의를 통해 탈퇴를 요청할 수 있습니다. 탈퇴 시 데이터는 정책에 따라 삭제됩니다.",
    },
    {
        "id": 6,
        "question": "첨부파일은 등록할 수 있나요?",
        "answer": "문의 작성 시 JPEG, PNG, GIF, WEBP 이미지를 1개 첨부할 수 있습니다 (최대 10MB).",
    },
]

ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
SUPPORT_REPLY_ADMIN_LOGIN_ID = "destinu"
SUPPORT_REPLY_ADMIN_EMAILS = frozenset({"dudfhr010@gmail.com"})
SUPPORT_REPLY_ADMIN_DISPLAY_NAME = "주린닷컴 고객센터"
ALLOWED_ATTACHMENT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_ATTACHMENT_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


def _fetch_user_auth(cursor, user_id: int) -> tuple[str, str]:
    cursor.execute(
        "SELECT login_id, email FROM users WHERE user_id = %s LIMIT 1",
        (user_id,),
    )
    row = cursor.fetchone()
    if not row:
        return "", ""
    login_id = (row.get("login_id") or "").strip()
    email = (row.get("email") or "").strip()
    return login_id, email


def _is_reply_admin(login_id: str | None, email: str | None = None) -> bool:
    login_key = (login_id or "").strip().lower()
    if login_key == SUPPORT_REPLY_ADMIN_LOGIN_ID:
        return True
    if login_key in SUPPORT_REPLY_ADMIN_EMAILS:
        return True
    return (email or "").strip().lower() in SUPPORT_REPLY_ADMIN_EMAILS


def _upload_root() -> str:
    root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "uploads", "support_inquiries")
    )
    os.makedirs(root, exist_ok=True)
    return root


def _serialize_attachment(inquiry_id: int, row: dict) -> dict:
    attachment_id = int(row["attachment_id"])
    return {
        "attachmentId": attachment_id,
        "originalName": row.get("original_name") or "",
        "mimeType": row.get("mime_type") or "",
        "fileSize": int(row.get("file_size") or 0),
        "url": f"/api/support/inquiries/{inquiry_id}/attachments/{attachment_id}",
    }


def _fetch_attachments(cursor, inquiry_id: int) -> list[dict]:
    cursor.execute(
        """
        SELECT attachment_id, original_name, mime_type, file_size
        FROM support_inquiry_attachments
        WHERE inquiry_id = %s
        ORDER BY attachment_id ASC
        """,
        (inquiry_id,),
    )
    rows = cursor.fetchall() or []
    return [_serialize_attachment(inquiry_id, row) for row in rows]


def _session_is_inquiry_admin(conn, session_user_id: int | None) -> bool:
    if session_user_id is None:
        return False
    with conn.cursor() as cursor:
        login_id, email = _fetch_user_auth(cursor, int(session_user_id))
    return _is_reply_admin(login_id, email)


def _can_view_inquiry_row(
    row: dict | None,
    session_user_id: int | None,
    *,
    session_is_admin: bool = False,
) -> bool:
    if not row:
        return False
    if session_is_admin:
        return True
    is_private = _as_bool(row.get("is_private"))
    owner_id = int(row["user_id"])
    if is_private and (session_user_id is None or int(session_user_id) != owner_id):
        return False
    return True


def _save_inquiry_attachment(cursor, inquiry_id: int, file_storage) -> dict:
    if file_storage is None or not getattr(file_storage, "filename", None):
        raise ValueError("invalid_attachment")

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
    dest_dir = os.path.join(_upload_root(), str(inquiry_id))
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, stored_name)
    file_storage.save(dest_path)

    safe_original = secure_filename(original_name) or f"image{ext}"
    cursor.execute(
        """
        INSERT INTO support_inquiry_attachments
          (inquiry_id, original_name, stored_name, mime_type, file_size)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (inquiry_id, safe_original, stored_name, mime_type, size),
    )
    attachment_id = int(cursor.lastrowid)
    return _serialize_attachment(
        inquiry_id,
        {
            "attachment_id": attachment_id,
            "original_name": safe_original,
            "mime_type": mime_type,
            "file_size": size,
        },
    )


def get_attachment_file(
    conn,
    inquiry_id: int,
    attachment_id: int,
    session_user_id: int | None,
) -> dict | None:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT inquiry_id, user_id, is_private
            FROM support_inquiries
            WHERE inquiry_id = %s
            LIMIT 1
            """,
            (inquiry_id,),
        )
        inquiry_row = cursor.fetchone()
        session_is_admin = _session_is_inquiry_admin(conn, session_user_id)
        if not _can_view_inquiry_row(
            inquiry_row, session_user_id, session_is_admin=session_is_admin
        ):
            raise PermissionError("forbidden")

        cursor.execute(
            """
            SELECT attachment_id, original_name, stored_name, mime_type
            FROM support_inquiry_attachments
            WHERE inquiry_id = %s AND attachment_id = %s
            LIMIT 1
            """,
            (inquiry_id, attachment_id),
        )
        row = cursor.fetchone()
        if not row:
            return None

    path = os.path.join(
        _upload_root(),
        str(inquiry_id),
        row["stored_name"],
    )
    if not os.path.isfile(path):
        return None

    return {
        "path": path,
        "mime_type": row.get("mime_type") or "application/octet-stream",
        "original_name": row.get("original_name") or "attachment",
    }


def _as_bool(val) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return int(val) != 0
    if isinstance(val, str):
        return val.strip().lower() in {"1", "true", "yes", "y"}
    return bool(val)


def _serialize_row(row: dict, *, include_body: bool = False) -> dict:
    category = row.get("category") or "other"
    status = row.get("status") or "waiting"
    reply_count = int(row.get("reply_count") or 0)
    item = {
        "inquiryId": int(row["inquiry_id"]),
        "userId": int(row["user_id"]),
        "category": category,
        "categoryLabel": CATEGORIES.get(category, category),
        "title": row.get("title") or "",
        "authorNickname": author_row_nickname(row),
        "authorAvatarUrl": author_row_avatar_url(row),
        "status": status,
        "statusLabel": STATUS_LABELS.get(status, status),
        "isPrivate": _as_bool(row.get("is_private")),
        "viewCount": int(row.get("view_count") or 0),
        "createdAt": row["created_at"].isoformat(sep=" ", timespec="seconds")
        if row.get("created_at")
        else None,
        "updatedAt": row["updated_at"].isoformat(sep=" ", timespec="seconds")
        if row.get("updated_at")
        else None,
        "replyCount": reply_count,
        "hasReply": reply_count > 0,
    }
    if include_body:
        item["body"] = row.get("body") or ""
    return item


def _list_where(
    *,
    mine: bool,
    session_user_id: int | None,
    category: str | None,
    status: str | None,
    q: str | None,
) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []

    if mine:
        if session_user_id is None:
            raise PermissionError("login_required")
        clauses.append("i.user_id = %s")
        params.append(session_user_id)
    # 전체 문의(mine=False): 공개·비공개 모두 목록에 포함(비공개는 제목만, 상세는 canView로 제한)

    if category and category in CATEGORIES:
        clauses.append("i.category = %s")
        params.append(category)

    if status and status in STATUS_LABELS:
        if status == "answered":
            clauses.append("i.status IN ('answered', 'resolved')")
        else:
            clauses.append("i.status = %s")
            params.append(status)

    if q:
        like = f"%{q.strip()}%"
        clauses.append("(i.title LIKE %s OR i.body LIKE %s)")
        params.extend([like, like])

    where_sql = " AND ".join(clauses) if clauses else "1=1"
    return where_sql, params


def list_inquiries(
    conn,
    *,
    session_user_id: int | None,
    category: str | None = None,
    status: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 10,
    mine: bool = False,
) -> dict[str, Any]:
    where_sql, params = _list_where(
        mine=mine,
        session_user_id=session_user_id,
        category=category,
        status=status,
        q=q,
    )

    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS cnt
            FROM support_inquiries i
            WHERE {where_sql}
            """,
            params,
        )
        total = int((cursor.fetchone() or {}).get("cnt") or 0)

        offset = (page - 1) * page_size
        cursor.execute(
            f"""
            SELECT
              i.inquiry_id, i.user_id, i.category, i.title, i.body,
              i.status, i.is_private, i.view_count, i.created_at, i.updated_at,
              u.nickname AS author_nickname,
              u.login_id AS author_login_id,
              u.profile_image_path AS author_profile_image_path,
              u.google_picture_url AS author_google_picture_url,
              (SELECT COUNT(*) FROM support_inquiry_replies r WHERE r.inquiry_id = i.inquiry_id) AS reply_count
            FROM support_inquiries i
            LEFT JOIN users u ON u.user_id = i.user_id
            WHERE {where_sql}
            ORDER BY i.inquiry_id DESC
            LIMIT %s OFFSET %s
            """,
            params + [page_size, offset],
        )
        rows = cursor.fetchall() or []

    session_is_admin = _session_is_inquiry_admin(conn, session_user_id)
    items = []
    for row in rows:
        item = _serialize_row(row)
        owner_id = int(row["user_id"])
        if session_user_id is not None:
            item["isOwner"] = owner_id == int(session_user_id)
        else:
            item["isOwner"] = False
        item["canView"] = _can_view_inquiry_row(
            row, session_user_id, session_is_admin=session_is_admin
        )
        items.append(item)
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": total_pages,
    }


def get_inquiry_detail(conn, inquiry_id: int, session_user_id: int | None) -> dict | None:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
              i.inquiry_id, i.user_id, i.category, i.title, i.body,
              i.status, i.is_private, i.view_count, i.created_at, i.updated_at,
              u.nickname AS author_nickname,
              u.login_id AS author_login_id,
              u.profile_image_path AS author_profile_image_path,
              u.google_picture_url AS author_google_picture_url
            FROM support_inquiries i
            LEFT JOIN users u ON u.user_id = i.user_id
            WHERE i.inquiry_id = %s
            LIMIT 1
            """,
            (inquiry_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        owner_id = int(row["user_id"])
        session_is_admin = _session_is_inquiry_admin(conn, session_user_id)
        if not _can_view_inquiry_row(
            row, session_user_id, session_is_admin=session_is_admin
        ):
            raise PermissionError("forbidden")

        cursor.execute(
            """
            UPDATE support_inquiries
            SET view_count = view_count + 1
            WHERE inquiry_id = %s
            """,
            (inquiry_id,),
        )
        row["view_count"] = int(row.get("view_count") or 0) + 1

        cursor.execute(
            """
            SELECT reply_id, inquiry_id, admin_name, body, created_at
            FROM support_inquiry_replies
            WHERE inquiry_id = %s
            ORDER BY created_at ASC
            """,
            (inquiry_id,),
        )
        replies = cursor.fetchall() or []
        row["reply_count"] = len(replies)

        feedback = None
        if session_user_id is not None:
            cursor.execute(
                """
                SELECT helpful
                FROM support_inquiry_feedback
                WHERE inquiry_id = %s AND user_id = %s
                LIMIT 1
                """,
                (inquiry_id, session_user_id),
            )
            fb = cursor.fetchone()
            if fb is not None:
                feedback = {"helpful": bool(fb.get("helpful"))}

        try:
            attachments = _fetch_attachments(cursor, inquiry_id)
        except Exception as exc:
            if getattr(exc, "args", None) and exc.args[0] == 1146:
                attachments = []
            else:
                raise

        can_edit_reply = session_is_admin

    detail = _serialize_row(row, include_body=True)
    detail["isOwner"] = session_user_id is not None and session_user_id == owner_id
    detail["canView"] = True
    detail["isAdminViewer"] = session_is_admin
    detail["canEditReply"] = can_edit_reply
    detail["replies"] = [
        {
            "replyId": int(r["reply_id"]),
            "adminName": r.get("admin_name") or "주린닷컴 고객센터",
            "body": r.get("body") or "",
            "createdAt": r["created_at"].isoformat(sep=" ", timespec="seconds")
            if r.get("created_at")
            else None,
        }
        for r in replies
    ]
    detail["feedback"] = feedback
    detail["attachments"] = attachments
    return detail


def create_inquiry(
    conn,
    user_id: int,
    *,
    category: str,
    title: str,
    body: str,
    is_private: bool,
    attachment_file=None,
) -> dict:
    if category not in CATEGORIES:
        raise ValueError("invalid_category")
    title = (title or "").strip()
    body = (body or "").strip()
    if not title or len(title) > 200:
        raise ValueError("invalid_title")
    if not body or len(body) < 10:
        raise ValueError("invalid_body")

    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO support_inquiries (user_id, category, title, body, is_private)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, category, title, body, 1 if is_private else 0),
        )
        inquiry_id = int(cursor.lastrowid)
        attachments: list[dict] = []
        if attachment_file is not None:
            attachments.append(_save_inquiry_attachment(cursor, inquiry_id, attachment_file))
        cursor.execute(
            """
            SELECT
              i.inquiry_id, i.user_id, i.category, i.title, i.body,
              i.status, i.is_private, i.view_count, i.created_at, i.updated_at,
              u.nickname AS author_nickname,
              u.login_id AS author_login_id,
              u.profile_image_path AS author_profile_image_path,
              u.google_picture_url AS author_google_picture_url,
              0 AS reply_count
            FROM support_inquiries i
            LEFT JOIN users u ON u.user_id = i.user_id
            WHERE i.inquiry_id = %s
            LIMIT 1
            """,
            (inquiry_id,),
        )
        row = cursor.fetchone()

    result = _serialize_row(row, include_body=True)
    if attachments:
        result["attachments"] = attachments
    return result


def submit_feedback(conn, inquiry_id: int, user_id: int, helpful: bool) -> dict:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT inquiry_id, user_id, is_private
            FROM support_inquiries
            WHERE inquiry_id = %s
            LIMIT 1
            """,
            (inquiry_id,),
        )
        row = cursor.fetchone()
        if not row:
            return {"ok": False, "reason": "not_found"}

        owner_id = int(row["user_id"])
        is_private = _as_bool(row.get("is_private"))
        if is_private and int(user_id) != owner_id:
            return {"ok": False, "reason": "forbidden"}

        cursor.execute(
            """
            INSERT INTO support_inquiry_feedback (inquiry_id, user_id, helpful)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE helpful = VALUES(helpful)
            """,
            (inquiry_id, user_id, 1 if helpful else 0),
        )

    return {"ok": True, "helpful": helpful}


def _remove_inquiry_upload_dir(inquiry_id: int) -> None:
    path = os.path.join(_upload_root(), str(inquiry_id))
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)


def _remove_inquiry_attachments(cursor, inquiry_id: int) -> None:
    cursor.execute(
        """
        SELECT stored_name
        FROM support_inquiry_attachments
        WHERE inquiry_id = %s
        """,
        (inquiry_id,),
    )
    rows = cursor.fetchall() or []
    if not rows:
        return
    cursor.execute(
        "DELETE FROM support_inquiry_attachments WHERE inquiry_id = %s",
        (inquiry_id,),
    )
    dest_dir = os.path.join(_upload_root(), str(inquiry_id))
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


def update_inquiry(
    conn,
    inquiry_id: int,
    user_id: int,
    *,
    category: str,
    title: str,
    body: str,
    is_private: bool,
    attachment_file=None,
    remove_attachment: bool = False,
) -> dict | None:
    if category not in CATEGORIES:
        raise ValueError("invalid_category")
    title = (title or "").strip()
    body = (body or "").strip()
    if not title or len(title) > 200:
        raise ValueError("invalid_title")
    if not body or len(body) < 10:
        raise ValueError("invalid_body")

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT inquiry_id, user_id
            FROM support_inquiries
            WHERE inquiry_id = %s
            LIMIT 1
            """,
            (inquiry_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        if int(row["user_id"]) != int(user_id):
            raise PermissionError("forbidden")

        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM support_inquiry_replies
            WHERE inquiry_id = %s
            """,
            (inquiry_id,),
        )
        reply_row = cursor.fetchone() or {}
        if int(reply_row.get("cnt") or 0) > 0:
            raise ValueError("has_replies")

        cursor.execute(
            """
            UPDATE support_inquiries
            SET category = %s, title = %s, body = %s, is_private = %s
            WHERE inquiry_id = %s
            """,
            (category, title, body, 1 if is_private else 0, inquiry_id),
        )
        if attachment_file is not None:
            _remove_inquiry_attachments(cursor, inquiry_id)
            _save_inquiry_attachment(cursor, inquiry_id, attachment_file)
        elif remove_attachment:
            _remove_inquiry_attachments(cursor, inquiry_id)

    return get_inquiry_detail(conn, inquiry_id, user_id)


def delete_inquiry(conn, inquiry_id: int, user_id: int) -> dict:
    """문의 삭제 — 답변·첨부·피드백·업로드 파일도 함께 제거 (FK CASCADE + 명시 삭제)."""
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT inquiry_id, user_id
            FROM support_inquiries
            WHERE inquiry_id = %s
            LIMIT 1
            """,
            (inquiry_id,),
        )
        row = cursor.fetchone()
        if not row:
            return {"ok": False, "reason": "not_found"}
        if int(row["user_id"]) != int(user_id):
            return {"ok": False, "reason": "forbidden"}

        cursor.execute(
            "DELETE FROM support_inquiry_feedback WHERE inquiry_id = %s",
            (inquiry_id,),
        )
        cursor.execute(
            "DELETE FROM support_inquiry_attachments WHERE inquiry_id = %s",
            (inquiry_id,),
        )
        cursor.execute(
            "DELETE FROM support_inquiry_replies WHERE inquiry_id = %s",
            (inquiry_id,),
        )
        cursor.execute(
            "DELETE FROM support_inquiries WHERE inquiry_id = %s",
            (inquiry_id,),
        )

    _remove_inquiry_upload_dir(inquiry_id)
    return {"ok": True, "inquiryId": inquiry_id}


def create_inquiry_reply(
    conn,
    inquiry_id: int,
    *,
    user_id: int,
    body: str,
) -> dict:
    with conn.cursor() as cursor:
        admin_login_id, admin_email = _fetch_user_auth(cursor, user_id)
        if not _is_reply_admin(admin_login_id, admin_email):
            raise PermissionError("forbidden")

        body = (body or "").strip()
        if not body or len(body) < 5:
            raise ValueError("invalid_body")

        cursor.execute(
            """
            SELECT inquiry_id
            FROM support_inquiries
            WHERE inquiry_id = %s
            LIMIT 1
            """,
            (inquiry_id,),
        )
        if not cursor.fetchone():
            return {"ok": False, "reason": "not_found"}

        cursor.execute(
            """
            INSERT INTO support_inquiry_replies (inquiry_id, admin_name, body)
            VALUES (%s, %s, %s)
            """,
            (inquiry_id, SUPPORT_REPLY_ADMIN_DISPLAY_NAME, body),
        )
        reply_id = int(cursor.lastrowid)

        cursor.execute(
            """
            UPDATE support_inquiries
            SET status = 'answered', updated_at = CURRENT_TIMESTAMP
            WHERE inquiry_id = %s
            """,
            (inquiry_id,),
        )

        cursor.execute(
            """
            SELECT reply_id, inquiry_id, admin_name, body, created_at
            FROM support_inquiry_replies
            WHERE inquiry_id = %s AND reply_id = %s
            LIMIT 1
            """,
            (inquiry_id, reply_id),
        )
        row = cursor.fetchone()

    if not row:
        return {"ok": False, "reason": "not_found"}

    return {
        "ok": True,
        "reply": {
            "replyId": int(row["reply_id"]),
            "adminName": row.get("admin_name") or SUPPORT_REPLY_ADMIN_DISPLAY_NAME,
            "body": row.get("body") or "",
            "createdAt": row["created_at"].isoformat(sep=" ", timespec="seconds")
            if row.get("created_at")
            else None,
        },
    }


def update_inquiry_reply(
    conn,
    inquiry_id: int,
    reply_id: int,
    *,
    user_id: int,
    body: str,
) -> dict:
    with conn.cursor() as cursor:
        admin_login_id, admin_email = _fetch_user_auth(cursor, user_id)
        if not _is_reply_admin(admin_login_id, admin_email):
            raise PermissionError("forbidden")

        body = (body or "").strip()
        if not body or len(body) < 5:
            raise ValueError("invalid_body")

        cursor.execute(
            """
            SELECT reply_id
            FROM support_inquiry_replies
            WHERE inquiry_id = %s AND reply_id = %s
            LIMIT 1
            """,
            (inquiry_id, reply_id),
        )
        if not cursor.fetchone():
            return {"ok": False, "reason": "not_found"}

        cursor.execute(
            """
            UPDATE support_inquiry_replies
            SET body = %s
            WHERE inquiry_id = %s AND reply_id = %s
            """,
            (body, inquiry_id, reply_id),
        )

        cursor.execute(
            """
            SELECT reply_id, inquiry_id, admin_name, body, created_at
            FROM support_inquiry_replies
            WHERE inquiry_id = %s AND reply_id = %s
            LIMIT 1
            """,
            (inquiry_id, reply_id),
        )
        row = cursor.fetchone()

    if not row:
        return {"ok": False, "reason": "not_found"}

    return {
        "ok": True,
        "reply": {
            "replyId": int(row["reply_id"]),
            "adminName": row.get("admin_name") or "주린닷컴 고객센터",
            "body": row.get("body") or "",
            "createdAt": row["created_at"].isoformat(sep=" ", timespec="seconds")
            if row.get("created_at")
            else None,
        },
    }


def delete_inquiry_reply(
    conn,
    inquiry_id: int,
    reply_id: int,
    *,
    user_id: int,
) -> dict:
    with conn.cursor() as cursor:
        admin_login_id, admin_email = _fetch_user_auth(cursor, user_id)
        if not _is_reply_admin(admin_login_id, admin_email):
            raise PermissionError("forbidden")

        cursor.execute(
            """
            SELECT reply_id
            FROM support_inquiry_replies
            WHERE inquiry_id = %s AND reply_id = %s
            LIMIT 1
            """,
            (inquiry_id, reply_id),
        )
        if not cursor.fetchone():
            return {"ok": False, "reason": "not_found"}

        cursor.execute(
            """
            DELETE FROM support_inquiry_replies
            WHERE inquiry_id = %s AND reply_id = %s
            """,
            (inquiry_id, reply_id),
        )

        cursor.execute(
            """
            SELECT COUNT(*) AS reply_count
            FROM support_inquiry_replies
            WHERE inquiry_id = %s
            """,
            (inquiry_id,),
        )
        remaining = int((cursor.fetchone() or {}).get("reply_count") or 0)
        if remaining == 0:
            cursor.execute(
                """
                UPDATE support_inquiries
                SET status = 'waiting'
                WHERE inquiry_id = %s
                """,
                (inquiry_id,),
            )

    return {"ok": True, "replyId": reply_id, "remainingReplies": remaining}


def get_faq_payload() -> dict[str, Any]:
    return {
        "categories": [{"id": k, "label": v} for k, v in CATEGORIES.items()],
        "statuses": [
            {"id": "waiting", "label": "대기"},
            {"id": "answered", "label": "완료"},
        ],
        "items": FAQ_ITEMS,
    }
