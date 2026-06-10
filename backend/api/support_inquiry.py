"""문의 게시판 API (/api/support/*)."""

from flask import Blueprint, jsonify, request, send_file, session

from auth_api import get_connection as get_db_connection
from services import support_inquiry_service

support_inquiry_bp = Blueprint("support_inquiry", __name__)


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
        return jsonify(
            {
                "success": False,
                "message": "support_inquiries 테이블이 없습니다. SQL/add_support_inquiries.sql 을 적용하세요.",
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


@support_inquiry_bp.route("/api/support/faq", methods=["GET"])
def support_faq():
    payload = support_inquiry_service.get_faq_payload()
    return jsonify({"success": True, **payload})


@support_inquiry_bp.route("/api/support/inquiries/mine", methods=["GET"])
def support_inquiries_mine():
    user_id, err = _require_user_id()
    if err:
        return err

    category = (request.args.get("category") or "").strip() or None
    status = (request.args.get("status") or "").strip() or None
    q = (request.args.get("q") or "").strip() or None
    page, page_size = _parse_page_args()

    try:
        conn = get_db_connection()
        try:
            data = support_inquiry_service.list_inquiries(
                conn,
                session_user_id=user_id,
                category=category,
                status=status,
                q=q,
                page=page,
                page_size=page_size,
                mine=True,
            )
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, **data})


@support_inquiry_bp.route("/api/support/inquiries", methods=["GET"])
def support_inquiries_list():
    session_user_id = _session_user_id()
    category = (request.args.get("category") or "").strip() or None
    status = (request.args.get("status") or "").strip() or None
    q = (request.args.get("q") or "").strip() or None
    page, page_size = _parse_page_args()

    try:
        conn = get_db_connection()
        try:
            data = support_inquiry_service.list_inquiries(
                conn,
                session_user_id=session_user_id,
                category=category,
                status=status,
                q=q,
                page=page,
                page_size=page_size,
                mine=False,
            )
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, **data})


@support_inquiry_bp.route("/api/support/inquiries", methods=["POST"])
def support_inquiries_create():
    user_id, err = _require_user_id()
    if err:
        return err

    attachment_file = None
    if request.content_type and "multipart/form-data" in request.content_type:
        category = (request.form.get("category") or "").strip()
        title = (request.form.get("title") or "").strip()
        body = (request.form.get("body") or "").strip()
        is_private_raw = (request.form.get("isPrivate") or request.form.get("is_private") or "").strip().lower()
        is_private = is_private_raw in {"1", "true", "yes", "on"}
        attachment_file = request.files.get("attachment")
        if attachment_file is not None and not attachment_file.filename:
            attachment_file = None
    else:
        data = request.get_json(silent=True) or {}
        category = (data.get("category") or "").strip()
        title = (data.get("title") or "").strip()
        body = (data.get("body") or "").strip()
        is_private = bool(data.get("isPrivate") or data.get("is_private"))

    try:
        conn = get_db_connection()
        try:
            item = support_inquiry_service.create_inquiry(
                conn,
                user_id,
                category=category,
                title=title,
                body=body,
                is_private=is_private,
                attachment_file=attachment_file,
            )
            conn.commit()
        except ValueError as ve:
            conn.rollback()
            code = str(ve)
            messages = {
                "invalid_category": "카테고리를 선택해 주세요.",
                "invalid_title": "제목을 1~200자로 입력해 주세요.",
                "invalid_body": "내용을 10자 이상 입력해 주세요.",
                "invalid_attachment": "첨부 이미지를 확인해 주세요.",
                "invalid_attachment_type": "JPEG, PNG, GIF, WEBP 이미지만 첨부할 수 있습니다.",
                "attachment_too_large": "첨부 이미지는 10MB 이하여야 합니다.",
            }
            return jsonify({"success": False, "message": messages.get(code, code)}), 400
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, "inquiry": item})


@support_inquiry_bp.route("/api/support/inquiries/<int:inquiry_id>", methods=["GET"])
def support_inquiry_detail(inquiry_id: int):
    session_user_id = _session_user_id()
    try:
        conn = get_db_connection()
        try:
            detail = support_inquiry_service.get_inquiry_detail(
                conn, inquiry_id, session_user_id
            )
            if not detail:
                return jsonify({"success": False, "message": "문의를 찾을 수 없습니다."}), 404
            conn.commit()
        except PermissionError as pe:
            conn.rollback()
            if str(pe) == "forbidden":
                return jsonify({"success": False, "message": "비공개 문의는 작성자만 열람할 수 있습니다."}), 403
            raise
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, "inquiry": detail})


def _parse_truthy_flag(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


@support_inquiry_bp.route("/api/support/inquiries/<int:inquiry_id>", methods=["PATCH"])
def support_inquiry_update(inquiry_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    attachment_file = None
    remove_attachment = False
    if request.content_type and "multipart/form-data" in request.content_type:
        category = (request.form.get("category") or "").strip()
        title = (request.form.get("title") or "").strip()
        body = (request.form.get("body") or "").strip()
        is_private_raw = (request.form.get("isPrivate") or request.form.get("is_private") or "").strip().lower()
        is_private = is_private_raw in {"1", "true", "yes", "on"}
        remove_attachment = _parse_truthy_flag(
            request.form.get("removeAttachment") or request.form.get("remove_attachment")
        )
        attachment_file = request.files.get("attachment")
        if attachment_file is not None and not attachment_file.filename:
            attachment_file = None
    else:
        data = request.get_json(silent=True) or {}
        category = (data.get("category") or "").strip()
        title = (data.get("title") or "").strip()
        body = (data.get("body") or "").strip()
        is_private = bool(data.get("isPrivate") or data.get("is_private"))
        remove_attachment = _parse_truthy_flag(
            data.get("removeAttachment", data.get("remove_attachment"))
        )

    try:
        conn = get_db_connection()
        try:
            detail = support_inquiry_service.update_inquiry(
                conn,
                inquiry_id,
                user_id,
                category=category,
                title=title,
                body=body,
                is_private=is_private,
                attachment_file=attachment_file,
                remove_attachment=remove_attachment,
            )
            if not detail:
                return jsonify({"success": False, "message": "문의를 찾을 수 없습니다."}), 404
            conn.commit()
        except ValueError as ve:
            conn.rollback()
            code = str(ve)
            messages = {
                "invalid_category": "카테고리를 선택해 주세요.",
                "invalid_title": "제목을 1~200자로 입력해 주세요.",
                "invalid_body": "내용을 10자 이상 입력해 주세요.",
                "has_replies": "답변이 등록된 문의는 수정할 수 없습니다.",
                "invalid_attachment": "첨부 이미지를 확인해 주세요.",
                "invalid_attachment_type": "JPEG, PNG, GIF, WEBP 이미지만 첨부할 수 있습니다.",
                "attachment_too_large": "첨부 이미지는 10MB 이하여야 합니다.",
            }
            return jsonify({"success": False, "message": messages.get(code, code)}), 400
        except PermissionError:
            conn.rollback()
            return jsonify({"success": False, "message": "본인이 작성한 문의만 수정할 수 있습니다."}), 403
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, "inquiry": detail})


@support_inquiry_bp.route("/api/support/inquiries/<int:inquiry_id>", methods=["DELETE"])
def support_inquiry_delete(inquiry_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    try:
        conn = get_db_connection()
        try:
            result = support_inquiry_service.delete_inquiry(conn, inquiry_id, user_id)
            if not result.get("ok"):
                conn.rollback()
                reason = result.get("reason")
                if reason == "not_found":
                    return jsonify({"success": False, "message": "문의를 찾을 수 없습니다."}), 404
                if reason == "forbidden":
                    return jsonify({"success": False, "message": "본인이 작성한 문의만 삭제할 수 있습니다."}), 403
                return jsonify({"success": False, "message": "문의 삭제에 실패했습니다."}), 400
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, "inquiryId": inquiry_id})


@support_inquiry_bp.route("/api/support/inquiries/<int:inquiry_id>/replies", methods=["POST"])
def support_inquiry_reply_create(inquiry_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()

    try:
        conn = get_db_connection()
        try:
            result = support_inquiry_service.create_inquiry_reply(
                conn,
                inquiry_id,
                user_id=user_id,
                body=body,
            )
            if not result.get("ok"):
                conn.rollback()
                reason = result.get("reason")
                if reason == "not_found":
                    return jsonify({"success": False, "message": "문의를 찾을 수 없습니다."}), 404
                return jsonify({"success": False, "message": "답변 등록에 실패했습니다."}), 400
            conn.commit()
        except PermissionError as pe:
            conn.rollback()
            if str(pe) == "forbidden":
                return jsonify({"success": False, "message": "답변 등록 권한이 없습니다."}), 403
            raise
        except ValueError as ve:
            conn.rollback()
            if str(ve) == "invalid_body":
                return jsonify({"success": False, "message": "답변 내용을 5자 이상 입력해 주세요."}), 400
            raise
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, **result})


@support_inquiry_bp.route(
    "/api/support/inquiries/<int:inquiry_id>/replies/<int:reply_id>",
    methods=["PUT", "DELETE"],
)
def support_inquiry_reply_update(inquiry_id: int, reply_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    if request.method == "DELETE":
        try:
            conn = get_db_connection()
            try:
                result = support_inquiry_service.delete_inquiry_reply(
                    conn,
                    inquiry_id,
                    reply_id,
                    user_id=user_id,
                )
                if not result.get("ok"):
                    conn.rollback()
                    reason = result.get("reason")
                    if reason == "not_found":
                        return jsonify({"success": False, "message": "답변을 찾을 수 없습니다."}), 404
                    return jsonify({"success": False, "message": "답변 삭제에 실패했습니다."}), 400
                conn.commit()
            except PermissionError as pe:
                conn.rollback()
                if str(pe) == "forbidden":
                    return jsonify({"success": False, "message": "답변 삭제 권한이 없습니다."}), 403
                raise
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        except Exception as e:
            missing = _table_missing_response(e)
            if missing:
                return missing
            return jsonify({"success": False, "message": str(e)}), 500

        return jsonify({"success": True, **result})

    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()

    try:
        conn = get_db_connection()
        try:
            result = support_inquiry_service.update_inquiry_reply(
                conn,
                inquiry_id,
                reply_id,
                user_id=user_id,
                body=body,
            )
            if not result.get("ok"):
                conn.rollback()
                reason = result.get("reason")
                if reason == "not_found":
                    return jsonify({"success": False, "message": "답변을 찾을 수 없습니다."}), 404
                return jsonify({"success": False, "message": "답변 수정에 실패했습니다."}), 400
            conn.commit()
        except PermissionError as pe:
            conn.rollback()
            if str(pe) == "forbidden":
                return jsonify({"success": False, "message": "답변 수정 권한이 없습니다."}), 403
            raise
        except ValueError as ve:
            conn.rollback()
            if str(ve) == "invalid_body":
                return jsonify({"success": False, "message": "답변 내용을 5자 이상 입력해 주세요."}), 400
            raise
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({"success": True, **result})


@support_inquiry_bp.route(
    "/api/support/inquiries/<int:inquiry_id>/attachments/<int:attachment_id>",
    methods=["GET"],
)
def support_inquiry_attachment(inquiry_id: int, attachment_id: int):
    session_user_id = _session_user_id()
    try:
        conn = get_db_connection()
        try:
            file_info = support_inquiry_service.get_attachment_file(
                conn,
                inquiry_id,
                attachment_id,
                session_user_id,
            )
        finally:
            conn.close()
    except PermissionError as pe:
        if str(pe) == "forbidden":
            return jsonify({"success": False, "message": "첨부 파일을 열람할 권한이 없습니다."}), 403
        raise
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    if not file_info:
        return jsonify({"success": False, "message": "첨부 파일을 찾을 수 없습니다."}), 404

    return send_file(
        file_info["path"],
        mimetype=file_info["mime_type"],
        as_attachment=False,
        download_name=file_info["original_name"],
    )


@support_inquiry_bp.route("/api/support/inquiries/<int:inquiry_id>/feedback", methods=["POST"])
def support_inquiry_feedback(inquiry_id: int):
    user_id, err = _require_user_id()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    if "helpful" not in data:
        return jsonify({"success": False, "message": "helpful 값이 필요합니다."}), 400
    helpful = bool(data.get("helpful"))

    try:
        conn = get_db_connection()
        try:
            result = support_inquiry_service.submit_feedback(
                conn, inquiry_id, user_id, helpful
            )
            if not result.get("ok"):
                conn.rollback()
                reason = result.get("reason")
                if reason == "not_found":
                    return jsonify({"success": False, "message": "문의를 찾을 수 없습니다."}), 404
                if reason == "forbidden":
                    return jsonify({"success": False, "message": "피드백을 남길 권한이 없습니다."}), 403
                return jsonify({"success": False, "message": "피드백 저장에 실패했습니다."}), 400
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        missing = _table_missing_response(e)
        if missing:
            return missing
        return jsonify({"success": False, "message": str(e)}), 500

    return jsonify({
        "success": True,
        "helpful": helpful,
        "feedbackStats": result.get("feedbackStats") or {
            "helpfulCount": 0,
            "notHelpfulCount": 0,
        },
    })
