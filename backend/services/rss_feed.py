"""RSS 수집·DB 동기화 (뉴스 API에서 사용)."""

import traceback

import requests

import news_service
from app_state import NEWS_DB_SYNC, RSS_FEEDS, _NEWS_STOCK_REL_SYNC
from auth_api import get_connection as get_db_connection


def fetch_rss_items(limit=12):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    }

    for feed_url in RSS_FEEDS:
        try:
            response = requests.get(feed_url, headers=headers, timeout=10)
            response.raise_for_status()

            parsed = news_service.parse_rss_channel_bytes(
                response.content,
                feed_url,
                default_source="매일경제",
                limit=limit,
            )
            if not parsed:
                continue

            if NEWS_DB_SYNC:
                try:
                    conn = get_db_connection()
                    try:
                        news_service.upsert_rss_batch(conn, parsed)
                        if _NEWS_STOCK_REL_SYNC:
                            try:
                                news_service.sync_news_stock_links(
                                    conn, scan_limit=max(len(parsed) * 4, limit * 3, 40)
                                )
                            except Exception as rel_err:
                                print(f"[RSS] news_stock_rel 동기화 실패: {rel_err}")
                        conn.commit()
                        items = news_service.fetch_recent_list(conn, limit=limit)
                        return {"success": True, "items": items, "feed": feed_url, "from_db": True}
                    except Exception as db_err:
                        conn.rollback()
                        print(f"[RSS/DB] 동기화 실패, RSS 페이로드만 반환: {db_err}")
                        traceback.print_exc()
                    finally:
                        conn.close()
                except Exception as conn_err:
                    print(f"[RSS/DB] DB 연결 실패: {conn_err}")

            items = news_service.serialize_parsed_for_api(parsed)
            return {"success": True, "items": items, "feed": feed_url, "from_db": False}
        except Exception as err:
            print(f"[RSS] 피드 로드 실패 ({feed_url}): {err}")

    return {"success": False, "message": "RSS 피드를 불러오지 못했습니다."}
