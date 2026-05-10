"""뉴스·RSS API (/api/rss/news, /api/news/*)."""

import re

from flask import Blueprint, jsonify, request

import news_service
from app_state import GPT_AVAILABLE, NEWS_READER_DIGEST
from auth_api import get_connection as get_db_connection
from services.gpt_client import clean_gpt_prose
from services.news_reader import explain_news_reader_text
from services.rss_feed import fetch_rss_items

news_bp = Blueprint("news", __name__)


@news_bp.route("/api/rss/news", methods=["GET"])
def rss_news():
    """RSS 뉴스 프록시 API"""
    try:
        limit = int(request.args.get("limit", "12"))
    except ValueError:
        limit = 12

    limit = max(1, min(limit, 30))
    result = fetch_rss_items(limit=limit)

    if not result.get("success"):
        return jsonify({"success": False, "message": result.get("message", "RSS 조회 실패")}), 502

    return jsonify(
        {
            "success": True,
            "items": result.get("items", []),
            "feed": result.get("feed", ""),
            "from_db": result.get("from_db", False),
        }
    )


@news_bp.route("/api/news/<int:news_id>", methods=["GET"])
def news_detail(news_id: int):
    """단일 뉴스(본문 요약 + 선택 시 AI 쉬운 설명 생성/캐시)."""
    want_digest = (request.args.get("digest") or "").strip().lower() in ("1", "true", "y", "yes", "on")
    try:
        conn = get_db_connection()
        try:
            article = news_service.fetch_article_by_id(conn, news_id)
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"success": False, "message": f"DB 오류: {e}"}), 500

    if not article:
        return jsonify({"success": False, "message": "기사를 찾을 수 없습니다."}), 404

    if (article.get("reader_digest") or "").strip():
        article["reader_digest"] = clean_gpt_prose(article["reader_digest"])

    if want_digest and NEWS_READER_DIGEST and GPT_AVAILABLE:
        if not (article.get("reader_digest") or "").strip():
            gen = explain_news_reader_text(article.get("title") or "", article.get("summary") or "")
            if gen.get("success") and (gen.get("text") or "").strip():
                digest_text = clean_gpt_prose(gen["text"].strip())
                article["reader_digest"] = digest_text
                try:
                    conn = get_db_connection()
                    try:
                        news_service.update_reader_digest(conn, news_id, digest_text)
                        conn.commit()
                    except Exception as ex:
                        conn.rollback()
                        print(f"[news] reader_digest 저장 실패: {ex}")
                    finally:
                        conn.close()
                except Exception as ex:
                    print(f"[news] reader_digest DB 연결 실패: {ex}")
            else:
                article["digest_error"] = gen.get("message") or "설명 생성에 실패했습니다."
    elif want_digest and NEWS_READER_DIGEST and not GPT_AVAILABLE:
        article["digest_error"] = "AI 설명을 쓰려면 OPENAI_API_KEY 또는 GPT_API_KEY를 설정하세요."

    return jsonify(
        {
            "success": True,
            "article": article,
        }
    )


@news_bp.route("/api/news/by-stock/<code>", methods=["GET"])
def news_by_stock(code: str):
    """news_stock_rel + 인덱스로 종목 연관 뉴스 조회."""
    sym = re.sub(r"\D", "", str(code or ""))
    if len(sym) != 6:
        return jsonify({"success": False, "message": "6자리 종목코드가 필요합니다."}), 400
    try:
        limit = int(request.args.get("limit", "10"))
    except ValueError:
        limit = 10
    limit = max(1, min(limit, 30))
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as c:
                c.execute(
                    """
                    SELECT n.news_id, n.title, n.summary, n.url, n.img_url, n.source,
                           n.published_at, r.match_type, r.confidence
                    FROM news_stock_rel r
                    INNER JOIN stocks s ON s.stock_id = r.stock_id AND s.symbol = %s
                    INNER JOIN news_articles n ON n.news_id = r.news_id
                    ORDER BY n.published_at DESC, n.news_id DESC
                    LIMIT %s
                    """,
                    (sym, limit),
                )
                rows = [dict(x) for x in (c.fetchall() or [])]
        finally:
            conn.close()
    except Exception as e:
        err = getattr(e, "args", None)
        if err and err[0] == 1146:
            return jsonify({"success": True, "code": sym, "items": [], "notice": "news_stock_rel 테이블이 없습니다."})
        return jsonify({"success": False, "message": str(e)}), 500

    for it in rows:
        pa = it.get("published_at")
        if hasattr(pa, "isoformat"):
            it["published_at"] = pa.isoformat()
        cf = it.get("confidence")
        if cf is not None:
            try:
                it["confidence"] = float(cf)
            except (TypeError, ValueError):
                pass

    return jsonify({"success": True, "code": sym, "items": rows})
