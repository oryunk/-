"""커뮤니티 API (/api/community/*)."""

from flask import Blueprint, jsonify, request, send_file, session

from auth_api import get_connection as get_db_connection
from services import community_service

community_bp = Blueprint("community", __name__)


def _session_user_id():
    uid = session.get("user_id")
    if uid is None:
        return None
    return int(uid)


def _require_user_id():
    uid = _session_user_id()
    if not uid:
        return None, (jsonify({"success": False, "message": "로그인이 필요합니다."}), 401)
    return uid, None


def _table_missing_response(exc: Exception):
    err_args = getattr(exc, "args", None)
    if err_args and err_args[0] == 1146:
        detail = str(err_args[1]) if len(err_args) > 1 else ""
        if "community_post_likes" in detail:
            return jsonify(
                {
                    "success": False,
                    "message": "community_post_likes 테이블이 없습니다. SQL/add_community_likes.sql 을 적용하세요.",
                }
            ), 503
        if "community_comments" in detail:
            return jsonify(
                {
                    "success": False,
                    "message": "community_comments 테이블이 없습니다. SQL/add_community_comments.sql 을 적용하세요.",
                }
            ), 503
        if "community_post_attachments" in detail:
            return jsonify(
                {
                    "success": False,
                    "message": "community_post_attachments 테이블이 없습니다. SQL/add_community_attachments.sql 을 적용하세요.",
                }
            ), 503
        if "community_post_polls" in detail or "community_poll_votes" in detail or "community_poll_options" in detail:
            return jsonify(
                {
                    "success": False,
                    "message": "community_poll_options 테이블이 없습니다. SQL/migrate_community_poll_options.sql 을 적용하세요.",
                }
            ), 503
        return jsonify(
            {
                "success": False,
                "message": "community_posts 테이블이 없습니다. SQL/add_community_posts.sql 을 적용하세요.",
            }
        ), 503
    return None


def _parse_page_args():
    try:
        page = int(request.args.get("page", "1"))
    except ValueError:
        page = 1
    try:
        page_size = int(request.args.get("page_size", request.args.get("pageSize", "10")))
    except ValueError:
        page_size = 10
    page = max(1, page)
    page_size = max(1, min(page_size, 50))
    return page, page_size


@community_bp.route("/api/community/meta", methods=["GET"])
def community_meta():
    payload = community_service.get_meta_payload()
    return jsonify({"success": True, **payload})


@community_bp.route("/api/community/posts/popular", methods=["GET"])
def community_posts_popular():
    try:
        limit = int(request.args.get("limit", "5"))
    except ValueError:
        limit = 5
    limit = max(1, min(limit, 20))
    try:
        conn = get_db_connection()
        try:
            items = community_service.list_popular_posts(conn, limit=limit)
            return jsonify({"success": True, "items": items})
        finally:
            conn.close()
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts", methods=["GET"])
def community_posts_list():
    board = (request.args.get("board") or "").strip() or None
    q = (request.args.get("q") or "").strip() or None
    stock_code = (request.args.get("stock_code") or request.args.get("stockCode") or "").strip() or None
    stock_name = (request.args.get("stock_name") or request.args.get("stockName") or "").strip() or None
    sort = (request.args.get("sort") or "latest").strip() or "latest"
    page, page_size = _parse_page_args()
    session_uid = _session_user_id()

    try:
        conn = get_db_connection()
        try:
            data = community_service.list_posts(
                conn,
                board=board,
                q=q,
                stock_code=stock_code,
                stock_name=stock_name,
                sort=sort,
                page=page,
                page_size=page_size,
                session_user_id=session_uid,
            )
            return jsonify({"success": True, **data})
        finally:
            conn.close()
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts", methods=["POST"])
def community_posts_create():
    user_id, err = _require_user_id()
    if err:
        return err

    attachment_file = None
    poll_enabled = False
    poll_ends_at = None
    poll_title = None
    poll_options = None
    if request.files or request.form:
        board = (request.form.get("board") or "").strip()
        title = (request.form.get("title") or "").strip()
        body = (request.form.get("body") or "").strip()
        stock_code = (
            request.form.get("stockCode") or request.form.get("stock_code") or ""
        ).strip() or None
        stock_name = (
            request.form.get("stockName") or request.form.get("stock_name") or ""
        ).strip() or None
        poll_enabled = request.form.get("pollEnabled") or request.form.get("poll_enabled")
        poll_ends_at = (
            request.form.get("pollEndsAt") or request.form.get("poll_ends_at") or ""
        ).strip() or None
        poll_title = (
            request.form.get("pollTitle") or request.form.get("poll_title") or ""
        ).strip() or None
        poll_options = request.form.get("pollOptions") or request.form.get("poll_options")
        attachment_file = request.files.get("attachment")
        if attachment_file is not None and not attachment_file.filename:
            attachment_file = None
    else:
        payload = request.get_json(silent=True) or {}
        board = (payload.get("board") or "").strip()
        title = (payload.get("title") or "").strip()
        body = (payload.get("body") or "").strip()
        stock_code = (payload.get("stockCode") or payload.get("stock_code") or "").strip() or None
        stock_name = (payload.get("stockName") or payload.get("stock_name") or "").strip() or None
        poll_enabled = payload.get("pollEnabled", payload.get("poll_enabled"))
        poll_ends_at = (
            payload.get("pollEndsAt") or payload.get("poll_ends_at") or ""
        ).strip() or None
        poll_title = (
            payload.get("pollTitle") or payload.get("poll_title") or ""
        ).strip() or None
        poll_options = payload.get("pollOptions", payload.get("poll_options"))

    try:
        conn = get_db_connection()
        try:
            item = community_service.create_post(
                conn,
                user_id=user_id,
                board=board,
                title=title,
                body=body,
                stock_code=stock_code,
                stock_name=stock_name,
                attachment_file=attachment_file,
                poll_enabled=poll_enabled,
                poll_ends_at=poll_ends_at,
                poll_title=poll_title,
                poll_options=poll_options,
            )
            return jsonify({"success": True, "item": item})
        finally:
            conn.close()
    except ValueError as exc:
        code = str(exc)
        messages = {
            "invalid_board": "게시판을 선택해 주세요.",
            "invalid_title": "제목을 1~200자로 입력해 주세요.",
            "invalid_body": "내용을 2자 이상 입력해 주세요.",
            "invalid_stock_code": "종목 코드 형식이 올바르지 않습니다.",
            "invalid_stock_name": "등록할 수 없는 종목명입니다. 자동검색 목록에서 종목을 선택해 주세요.",
            "invalid_attachment": "첨부 이미지를 확인해 주세요.",
            "invalid_attachment_type": "JPEG, PNG, GIF, WEBP 이미지만 첨부할 수 있습니다.",
            "attachment_too_large": "첨부 이미지는 10MB 이하여야 합니다.",
            "attachment_limit": "첨부 파일은 1개만 등록할 수 있습니다.",
            "invalid_poll_ends_at": "투표 마감 시간을 현재 이후로 설정해 주세요.",
            "invalid_poll_title": "투표 제목을 1~100자로 입력해 주세요.",
            "invalid_poll_options": "투표 선택지를 확인해 주세요.",
            "too_few_poll_options": "투표 선택지는 2개 이상 필요합니다.",
            "too_many_poll_options": "투표 선택지는 최대 5개까지 등록할 수 있습니다.",
            "duplicate_poll_option": "투표 선택지 이름이 중복되었습니다.",
        }
        return jsonify({"success": False, "message": messages.get(code, "입력값을 확인해 주세요.")}), 400
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts/<int:post_id>", methods=["GET"])
def community_posts_detail(post_id: int):
    session_uid = _session_user_id()
    raw_count = (request.args.get("count_view") or request.args.get("countView") or "1").strip().lower()
    increment_view = raw_count not in ("0", "false", "no")
    try:
        conn = get_db_connection()
        try:
            item = community_service.get_post(
                conn,
                post_id,
                session_user_id=session_uid,
                increment_view=increment_view,
            )
            if not item:
                return jsonify({"success": False, "message": "게시글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True, "item": item})
        finally:
            conn.close()
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route(
    "/api/community/posts/<int:post_id>/attachments/<int:attachment_id>",
    methods=["GET"],
)
def community_post_attachment(post_id: int, attachment_id: int):
    try:
        conn = get_db_connection()
        try:
            file_info = community_service.get_attachment_file(
                conn,
                post_id,
                attachment_id,
            )
        finally:
            conn.close()
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise

    if not file_info:
        return jsonify({"success": False, "message": "첨부 파일을 찾을 수 없습니다."}), 404

    return send_file(
        file_info["path"],
        mimetype=file_info["mime_type"],
        as_attachment=False,
        download_name=file_info["original_name"],
    )


@community_bp.route("/api/community/posts/<int:post_id>/poll/vote", methods=["POST"])
def community_poll_vote(post_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    payload = request.get_json(silent=True) or {}
    option_id = payload.get("optionId", payload.get("option_id"))
    try:
        option_id = int(option_id)
    except (TypeError, ValueError):
        option_id = 0

    try:
        conn = get_db_connection()
        try:
            poll = community_service.vote_poll(conn, post_id, user_id, option_id)
            if poll is None:
                return jsonify({"success": False, "message": "게시글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True, "poll": poll})
        finally:
            conn.close()
    except LookupError as exc:
        code = str(exc)
        if code == "poll_not_found":
            return jsonify({"success": False, "message": "투표가 없는 게시글입니다."}), 404
        raise
    except ValueError as exc:
        code = str(exc)
        messages = {
            "invalid_choice": "투표할 선택지를 확인해 주세요.",
            "poll_closed": "마감된 투표입니다.",
            "already_voted": "이미 투표하셨습니다.",
        }
        return jsonify({"success": False, "message": messages.get(code, "투표할 수 없습니다.")}), 400
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts/<int:post_id>/like", methods=["POST"])
def community_posts_like(post_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    try:
        conn = get_db_connection()
        try:
            result = community_service.like_post(conn, post_id, user_id)
            if not result:
                return jsonify({"success": False, "message": "게시글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True, **result})
        finally:
            conn.close()
    except Exception as exc:
        missing = _likes_table_missing_response(exc) or _table_missing_response(exc)
        if missing:
            return missing
        raise


def _likes_table_missing_response(exc: Exception):
    err_args = getattr(exc, "args", None)
    if err_args and err_args[0] == 1146:
        detail = str(err_args[1]) if len(err_args) > 1 else ""
        if "community_post_likes" in detail:
            return jsonify(
                {
                    "success": False,
                    "message": "community_post_likes 테이블이 없습니다. SQL/add_community_likes.sql 을 적용하세요.",
                }
            ), 503
    return None


def _parse_truthy_flag(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


@community_bp.route("/api/community/posts/<int:post_id>", methods=["PATCH"])
def community_posts_update(post_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    attachment_file = None
    remove_attachment = False
    remove_poll = False
    if request.files or request.form:
        board = (request.form.get("board") or "").strip()
        title = (request.form.get("title") or "").strip()
        body = (request.form.get("body") or "").strip()
        stock_code = (
            request.form.get("stockCode") or request.form.get("stock_code") or ""
        ).strip() or None
        stock_name = (
            request.form.get("stockName") or request.form.get("stock_name") or ""
        ).strip() or None
        remove_attachment = _parse_truthy_flag(
            request.form.get("removeAttachment") or request.form.get("remove_attachment")
        )
        remove_poll = _parse_truthy_flag(
            request.form.get("removePoll") or request.form.get("remove_poll")
        )
        attachment_file = request.files.get("attachment")
        if attachment_file is not None and not attachment_file.filename:
            attachment_file = None
    else:
        payload = request.get_json(silent=True) or {}
        board = (payload.get("board") or "").strip()
        title = (payload.get("title") or "").strip()
        body = (payload.get("body") or "").strip()
        stock_code = (payload.get("stockCode") or payload.get("stock_code") or "").strip() or None
        stock_name = (payload.get("stockName") or payload.get("stock_name") or "").strip() or None
        remove_attachment = _parse_truthy_flag(
            payload.get("removeAttachment", payload.get("remove_attachment"))
        )
        remove_poll = _parse_truthy_flag(payload.get("removePoll", payload.get("remove_poll")))

    try:
        conn = get_db_connection()
        try:
            item = community_service.update_post(
                conn,
                post_id=post_id,
                user_id=user_id,
                board=board,
                title=title,
                body=body,
                stock_code=stock_code,
                stock_name=stock_name,
                attachment_file=attachment_file,
                remove_attachment=remove_attachment,
                remove_poll=remove_poll,
            )
            if not item:
                return jsonify({"success": False, "message": "게시글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True, "item": item})
        finally:
            conn.close()
    except ValueError as exc:
        code = str(exc)
        messages = {
            "invalid_board": "게시판을 선택해 주세요.",
            "invalid_title": "제목을 1~200자로 입력해 주세요.",
            "invalid_body": "내용을 2자 이상 입력해 주세요.",
            "invalid_stock_code": "종목 코드 형식이 올바르지 않습니다.",
            "invalid_stock_name": "등록할 수 없는 종목명입니다. 자동검색 목록에서 종목을 선택해 주세요.",
            "invalid_attachment": "첨부 이미지를 확인해 주세요.",
            "invalid_attachment_type": "JPEG, PNG, GIF, WEBP 이미지만 첨부할 수 있습니다.",
            "attachment_too_large": "첨부 이미지는 10MB 이하여야 합니다.",
            "attachment_limit": "첨부 파일은 1개만 등록할 수 있습니다.",
        }
        return jsonify({"success": False, "message": messages.get(code, "입력값을 확인해 주세요.")}), 400
    except PermissionError:
        return jsonify({"success": False, "message": "수정 권한이 없습니다."}), 403
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts/<int:post_id>", methods=["DELETE"])
def community_posts_delete(post_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    try:
        conn = get_db_connection()
        try:
            ok = community_service.delete_post(conn, post_id=post_id, user_id=user_id)
            if not ok:
                return jsonify({"success": False, "message": "게시글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True})
        finally:
            conn.close()
    except PermissionError:
        return jsonify({"success": False, "message": "삭제 권한이 없습니다."}), 403
    except Exception as exc:
        missing = _table_missing_response(exc)
        if missing:
            return missing
        raise


def _comments_table_missing_response(exc: Exception):
    err_args = getattr(exc, "args", None)
    if err_args and err_args[0] == 1146:
        return jsonify(
            {
                "success": False,
                "message": "community_comments 테이블이 없습니다. SQL/add_community_comments.sql 을 적용하세요.",
            }
        ), 503
    return None


@community_bp.route("/api/community/posts/<int:post_id>/comments", methods=["GET"])
def community_comments_list(post_id: int):
    session_uid = _session_user_id()
    try:
        conn = get_db_connection()
        try:
            items = community_service.list_comments(conn, post_id, session_user_id=session_uid)
            if items is None:
                return jsonify({"success": False, "message": "게시글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True, "items": items})
        finally:
            conn.close()
    except Exception as exc:
        missing = _comments_table_missing_response(exc) or _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts/<int:post_id>/comments", methods=["POST"])
def community_comments_create(post_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    payload = request.get_json(silent=True) or {}
    body = (payload.get("body") or "").strip()

    try:
        conn = get_db_connection()
        try:
            item = community_service.create_comment(
                conn,
                post_id=post_id,
                user_id=user_id,
                body=body,
            )
            return jsonify({"success": True, "item": item})
        finally:
            conn.close()
    except LookupError:
        return jsonify({"success": False, "message": "게시글을 찾을 수 없습니다."}), 404
    except ValueError as exc:
        code = str(exc)
        messages = {
            "invalid_body": "댓글을 1~2000자로 입력해 주세요.",
            "lumicon_not_unlocked": "해금되지 않은 루미콘입니다. 학습 가이드 보상을 먼저 받아 주세요.",
        }
        return jsonify({"success": False, "message": messages.get(code, "입력값을 확인해 주세요.")}), 400
    except Exception as exc:
        missing = _comments_table_missing_response(exc) or _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts/<int:post_id>/comments/<int:comment_id>", methods=["PATCH"])
def community_comments_update(post_id: int, comment_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    payload = request.get_json(silent=True) or {}
    body = (payload.get("body") or "").strip()

    try:
        conn = get_db_connection()
        try:
            item = community_service.update_comment(
                conn,
                comment_id=comment_id,
                user_id=user_id,
                body=body,
            )
            if not item:
                return jsonify({"success": False, "message": "댓글을 찾을 수 없습니다."}), 404
            if int(item.get("postId") or 0) != int(post_id):
                return jsonify({"success": False, "message": "댓글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True, "item": item})
        finally:
            conn.close()
    except ValueError as exc:
        code = str(exc)
        messages = {
            "invalid_body": "댓글을 1~2000자로 입력해 주세요.",
            "lumicon_not_unlocked": "해금되지 않은 루미콘입니다. 학습 가이드 보상을 먼저 받아 주세요.",
        }
        return jsonify({"success": False, "message": messages.get(code, "댓글 내용을 확인해 주세요.")}), 400
    except PermissionError:
        return jsonify({"success": False, "message": "수정 권한이 없습니다."}), 403
    except Exception as exc:
        missing = _comments_table_missing_response(exc) or _table_missing_response(exc)
        if missing:
            return missing
        raise


@community_bp.route("/api/community/posts/<int:post_id>/comments/<int:comment_id>", methods=["DELETE"])
def community_comments_delete(post_id: int, comment_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    try:
        conn = get_db_connection()
        try:
            ok = community_service.delete_comment(conn, comment_id=comment_id, user_id=user_id)
            if not ok:
                return jsonify({"success": False, "message": "댓글을 찾을 수 없습니다."}), 404
            return jsonify({"success": True})
        finally:
            conn.close()
    except PermissionError:
        return jsonify({"success": False, "message": "삭제 권한이 없습니다."}), 403
    except Exception as exc:
        missing = _comments_table_missing_response(exc) or _table_missing_response(exc)
        if missing:
            return missing
        raise
