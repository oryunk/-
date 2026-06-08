"""루미 AI 챗봇 API (/api/lumi-chat/*)."""

from flask import Blueprint, jsonify, request, session

from auth_api import get_connection as get_db_connection
from services import lumi_chat_service

lumi_chat_bp = Blueprint("lumi_chat", __name__)


def _require_user_id():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"success": False, "message": "로그인이 필요합니다."}), 401)
    return int(uid), None


@lumi_chat_bp.route("/api/lumi-chat/config", methods=["GET"])
def lumi_chat_config():
    """공개 설정(인트로·추천 질문)."""
    return jsonify(
        {
            "success": True,
            "enabled": lumi_chat_service.LUMI_CHAT_ENABLED,
            "intro": lumi_chat_service.INTRO_MESSAGE,
            "quick_questions": lumi_chat_service.DEFAULT_QUICK_QUESTIONS,
        }
    )


@lumi_chat_bp.route("/api/lumi-chat/threads", methods=["GET"])
def lumi_chat_list_threads():
    user_id, err = _require_user_id()
    if err:
        return err
    try:
        limit = int(request.args.get("limit", "40"))
    except ValueError:
        limit = 40
    limit = max(1, min(limit, 80))
    try:
        conn = get_db_connection()
        try:
            items = lumi_chat_service.list_threads(conn, user_id, limit=limit)
        finally:
            conn.close()
    except Exception as e:
        err_args = getattr(e, "args", None)
        if err_args and err_args[0] == 1146:
            return jsonify(
                {
                    "success": False,
                    "message": "lumi_chat 테이블이 없습니다. SQL/add_lumi_chat.sql 을 적용하세요.",
                }
            ), 503
        return jsonify({"success": False, "message": str(e)}), 500
    return jsonify({"success": True, "threads": items})


@lumi_chat_bp.route("/api/lumi-chat/threads", methods=["POST"])
def lumi_chat_create_thread():
    user_id, err = _require_user_id()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip() or "새 대화"
    try:
        conn = get_db_connection()
        try:
            thread = lumi_chat_service.create_thread(conn, user_id, title=title)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        err_args = getattr(e, "args", None)
        if err_args and err_args[0] == 1146:
            return jsonify(
                {
                    "success": False,
                    "message": "lumi_chat 테이블이 없습니다. SQL/add_lumi_chat.sql 을 적용하세요.",
                }
            ), 503
        return jsonify({"success": False, "message": str(e)}), 500
    return jsonify({"success": True, "thread": thread})


@lumi_chat_bp.route("/api/lumi-chat/threads/<int:thread_id>/import-messages", methods=["POST"])
def lumi_chat_import_messages(thread_id: int):
    """게스트 대화 등 기존 메시지를 DB에 그대로 저장."""
    user_id, err = _require_user_id()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    raw_messages = data.get("messages") if isinstance(data.get("messages"), list) else []
    title = (data.get("title") or "").strip() or None
    try:
        conn = get_db_connection()
        try:
            thread = lumi_chat_service.import_thread_messages(
                conn,
                user_id,
                thread_id,
                raw_messages,
                title=title,
            )
            if not thread:
                conn.rollback()
                return jsonify({"success": False, "message": "대화를 찾을 수 없습니다."}), 404
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        err_args = getattr(e, "args", None)
        if err_args and err_args[0] == 1146:
            return jsonify(
                {
                    "success": False,
                    "message": "lumi_chat 테이블이 없습니다. SQL/add_lumi_chat.sql 을 적용하세요.",
                }
            ), 503
        return jsonify({"success": False, "message": str(e)}), 500
    return jsonify({"success": True, "thread": thread})


@lumi_chat_bp.route("/api/lumi-chat/threads/<int:thread_id>", methods=["GET"])
def lumi_chat_get_thread(thread_id: int):
    user_id, err = _require_user_id()
    if err:
        return err
    try:
        conn = get_db_connection()
        try:
            thread = lumi_chat_service.get_thread(conn, user_id, thread_id)
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    if not thread:
        return jsonify({"success": False, "message": "대화를 찾을 수 없습니다."}), 404
    return jsonify({"success": True, "thread": thread})


@lumi_chat_bp.route("/api/lumi-chat/threads/<int:thread_id>", methods=["DELETE"])
def lumi_chat_delete_thread(thread_id: int):
    user_id, err = _require_user_id()
    if err:
        return err
    try:
        conn = get_db_connection()
        try:
            ok = lumi_chat_service.delete_thread(conn, user_id, thread_id)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    if not ok:
        return jsonify({"success": False, "message": "대화를 찾을 수 없습니다."}), 404
    return jsonify({"success": True})


@lumi_chat_bp.route("/api/lumi-chat/threads/<int:thread_id>/messages", methods=["POST"])
def lumi_chat_post_message(thread_id: int):
    user_id, err = _require_user_id()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"success": False, "message": "메시지를 입력해주세요."}), 400
    page_hint = (data.get("page_hint") or request.headers.get("X-Jurin-Page") or "").strip() or None
    try:
        conn = get_db_connection()
        try:
            result = lumi_chat_service.append_exchange(
                conn, user_id, thread_id, message, page_hint=page_hint
            )
            if not result:
                conn.rollback()
                return jsonify({"success": False, "message": "대화를 찾을 수 없습니다."}), 404
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        err_args = getattr(e, "args", None)
        if err_args and err_args[0] == 1146:
            return jsonify(
                {
                    "success": False,
                    "message": "lumi_chat 테이블이 없습니다. SQL/add_lumi_chat.sql 을 적용하세요.",
                }
            ), 503
        return jsonify({"success": False, "message": str(e)}), 500
    return jsonify({"success": True, **result})


@lumi_chat_bp.route("/api/lumi-chat/reply", methods=["POST"])
def lumi_chat_reply_guest():
    """비로그인 1회 응답(FAQ/GPT, 저장 없음)."""
    if not lumi_chat_service.LUMI_CHAT_ENABLED:
        return jsonify({"success": False, "message": "챗봇이 비활성화되어 있습니다."}), 503
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"success": False, "message": "메시지를 입력해주세요."}), 400
    history = data.get("history") if isinstance(data.get("history"), list) else []
    page_hint = (data.get("page_hint") or "").strip() or None
    reply = lumi_chat_service.build_reply(message, history, page_hint=page_hint)
    return jsonify(
        {
            "success": True,
            "assistant_message": {
                "role": "assistant",
                "content": reply["text"],
                "mood": reply.get("mood"),
                "source": reply.get("source"),
            },
        }
    )
