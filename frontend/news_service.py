"""RSS 뉴스 파싱 및 news_articles 테이블 동기화."""

from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

try:
    from pymysql.err import ProgrammingError
except ImportError:
    ProgrammingError = type('ProgrammingError', (Exception,), {})  # type: ignore[misc, assignment]

_STRIP_TAGS = re.compile(r'<[^>]+>')
_MRSS_NS = '{http://search.yahoo.com/mrss/}'
_IMG_SRC_RE = re.compile(r'<img[^>]+src\s*=\s*["\']([^"\']+)["\']', re.I)


def strip_html(text: str | None, max_len: int = 8000) -> str:
    if not text:
        return ''
    s = html.unescape(str(text))
    s = _STRIP_TAGS.sub(' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    if len(s) > max_len:
        s = s[: max_len - 1] + '…'
    return s


def _parse_pub_date(raw: str | None) -> datetime:
    if not raw or not str(raw).strip():
        return datetime.now(timezone.utc).replace(tzinfo=None)
    s = str(raw).strip()
    try:
        dt = parsedate_to_datetime(s)
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        pass
    try:
        iso = s.replace('Z', '+00:00')
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return datetime.now(timezone.utc).replace(tzinfo=None)


def _first_img_from_html_raw(desc_raw: str | None) -> str | None:
    """RSS description 안의 첫 <img src=…> (일부 매체)."""
    if not desc_raw or not str(desc_raw).strip():
        return None
    m = _IMG_SRC_RE.search(str(desc_raw))
    if not m:
        return None
    u = html.unescape(m.group(1).strip())
    if u.startswith('//'):
        u = 'https:' + u
    if u.startswith('http://') or u.startswith('https://'):
        return u[:500]
    return None


def _first_img_from_item(item: ET.Element) -> str | None:
    """enclosure / media:content / mrss:thumbnail 순."""
    for mc in item.findall(f'{_MRSS_NS}content'):
        u = (mc.get('url') or '').strip()
        if not u:
            continue
        medium = (mc.get('medium') or '').lower()
        typ = (mc.get('type') or '').lower()
        if medium == 'image' or 'image/' in typ or typ.startswith('image/'):
            return u[:500]

    enc = item.find('enclosure')
    if enc is not None:
        t = (enc.get('type') or '').lower()
        u = (enc.get('url') or '').strip()
        if u and ('image' in t or t == ''):
            return u[:500]

    for th in item.findall(f'{_MRSS_NS}thumbnail'):
        u = (th.get('url') or '').strip()
        if u:
            return u[:500]
    return None


def _item_link(item: ET.Element) -> str:
    """RSS item 링크: <link>URL</link> 또는 <link href=\"URL\" />."""
    t = (item.findtext('link') or '').strip()
    if t:
        return t
    link_el = item.find('link')
    if link_el is not None:
        href = (link_el.get('href') or '').strip()
        if href:
            return href
    return ''


def parse_rss_channel_bytes(
    content: bytes,
    feed_url: str,
    *,
    default_source: str = '매일경제',
    limit: int = 20,
) -> list[dict[str, Any]]:
    """RSS XML 바이트 → 내부용 기사 dict 목록."""
    root = ET.fromstring(content)
    channel = root.find('channel')
    if channel is None:
        return []

    out: list[dict[str, Any]] = []
    for item in channel.findall('item')[:limit]:
        title = (item.findtext('title') or '제목 없음').strip()
        desc_raw = item.findtext('description') or ''
        link = _item_link(item)
        guid_el = item.find('guid')
        guid = (guid_el.text or '').strip() if guid_el is not None and guid_el.text else None
        if not link:
            continue
        if not guid:
            guid = link
        pub_raw = item.findtext('pubDate')
        cat = (item.findtext('category') or '').strip() or None
        summary = strip_html(desc_raw, max_len=4000)
        img = _first_img_from_item(item) or _first_img_from_html_raw(desc_raw)

        out.append(
            {
                'title': title,
                'summary': summary,
                'url': link[:500],
                'guid': (guid or link)[:255],
                'img_url': (img[:500] if img else None),
                'category': (cat[:50] if cat else None),
                'source': default_source[:100],
                'published_at': _parse_pub_date(pub_raw),
            }
        )
    return out


def _row_to_api_item(row: dict[str, Any]) -> dict[str, Any]:
    pub = row.get('published_at')
    if hasattr(pub, 'isoformat'):
        pub_iso = pub.isoformat()
    else:
        pub_iso = str(pub) if pub else ''
    return {
        'news_id': int(row['news_id']),
        'title': row.get('title') or '',
        'summary': row.get('summary') or '',
        'description': row.get('summary') or '',
        'link': row.get('url') or '',
        'pubDate': pub_iso,
        'published_at': pub_iso,
        'source': row.get('source') or '',
        'category': row.get('category'),
        'img_url': row.get('img_url'),
        'reader_digest': row.get('reader_digest'),
    }


def serialize_parsed_for_api(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """DB 없이 RSS만 쓸 때 프론트 호환 페이로드."""
    rows = []
    for r in items:
        p = r['published_at']
        pub_iso = p.isoformat() if hasattr(p, 'isoformat') else str(p)
        rows.append(
            {
                'news_id': None,
                'title': r['title'],
                'summary': r['summary'],
                'description': r['summary'],
                'link': r['url'],
                'pubDate': pub_iso,
                'published_at': pub_iso,
                'source': r['source'],
                'category': r['category'],
                'img_url': r['img_url'],
                'reader_digest': None,
            }
        )
    return rows


def upsert_rss_batch(conn, items: list[dict[str, Any]]) -> None:
    """news_articles 에 URL 기준 upsert (커밋은 호출측)."""
    if not items:
        return
    sql = """
        INSERT INTO news_articles (
            title, summary, url, guid, img_url, category, source, published_at, fetched_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, NOW()
        )
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            summary = VALUES(summary),
            img_url = VALUES(img_url),
            category = VALUES(category),
            published_at = VALUES(published_at),
            fetched_at = NOW()
    """
    with conn.cursor() as cur:
        for r in items:
            cur.execute(
                sql,
                (
                    r['title'][:255],
                    r['summary'] or None,
                    r['url'][:500],
                    r['guid'][:255] if r.get('guid') else None,
                    r['img_url'][:500] if r.get('img_url') else None,
                    r['category'][:50] if r.get('category') else None,
                    r['source'][:100],
                    r['published_at'],
                ),
            )


def fetch_recent_list(conn, limit: int = 20) -> list[dict[str, Any]]:
    """최신 목록. reader_digest 컬럼이 아직 없는 DB는 자동으로 NULL로 조회."""
    sql_with_digest = """
            SELECT news_id, title, summary, url, guid, img_url, category, source,
                   published_at, reader_digest
            FROM news_articles
            ORDER BY published_at DESC, news_id DESC
            LIMIT %s
            """
    sql_no_digest = """
            SELECT news_id, title, summary, url, guid, img_url, category, source,
                   published_at, NULL AS reader_digest
            FROM news_articles
            ORDER BY published_at DESC, news_id DESC
            LIMIT %s
            """
    with conn.cursor() as cur:
        try:
            cur.execute(sql_with_digest, (limit,))
        except ProgrammingError as e:
            if e.args and e.args[0] == 1054:
                cur.execute(sql_no_digest, (limit,))
            else:
                raise
        rows = cur.fetchall() or []
    return [_row_to_api_item(dict(r)) for r in rows]


def fetch_article_by_id(conn, news_id: int) -> dict[str, Any] | None:
    sql_full = """
            SELECT news_id, title, summary, url, guid, img_url, category, source,
                   published_at, fetched_at, reader_digest
            FROM news_articles
            WHERE news_id = %s
            LIMIT 1
            """
    sql_legacy = """
            SELECT news_id, title, summary, url, guid, img_url, category, source,
                   published_at, fetched_at, NULL AS reader_digest
            FROM news_articles
            WHERE news_id = %s
            LIMIT 1
            """
    with conn.cursor() as cur:
        try:
            cur.execute(sql_full, (news_id,))
        except ProgrammingError as e:
            if e.args and e.args[0] == 1054:
                cur.execute(sql_legacy, (news_id,))
            else:
                raise
        row = cur.fetchone()
    if not row:
        return None
    d = dict(row)
    base = _row_to_api_item(d)
    base['fetched_at'] = d.get('fetched_at')
    return base


def update_reader_digest(conn, news_id: int, text: str) -> None:
    with conn.cursor() as cur:
        try:
            cur.execute(
                """
                UPDATE news_articles
                SET reader_digest = %s
                WHERE news_id = %s
                """,
                (text, news_id),
            )
        except ProgrammingError as e:
            if e.args and e.args[0] == 1054:
                raise RuntimeError(
                    'news_articles.reader_digest 컬럼이 없습니다. SQL/add_news_reader_digest.sql 을 적용하세요.'
                ) from e
            raise


_CODE_6 = re.compile(r"(?<!\d)(\d{6})(?!\d)")


def sync_news_stock_links(conn, scan_limit: int = 60) -> None:
    """최근 기사 제목·요약에서 종목 코드·종목명을 찾아 news_stock_rel 에 반영 (종목별 뉴스 조회용)."""
    if scan_limit <= 0:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT news_id, title, summary FROM news_articles
                ORDER BY news_id DESC
                LIMIT %s
                """,
                (scan_limit,),
            )
            articles = [dict(r) for r in (cur.fetchall() or [])]
            try:
                cur.execute(
                    """
                    SELECT stock_id, symbol, name_ko FROM stocks
                    WHERE symbol IS NOT NULL AND symbol != ''
                      AND COALESCE(is_active, 1) = 1
                    """
                )
            except ProgrammingError:
                cur.execute(
                    """
                    SELECT stock_id, symbol, name_ko FROM stocks
                    WHERE symbol IS NOT NULL AND symbol != ''
                    """
                )
            stocks = [dict(r) for r in (cur.fetchall() or [])]
    except ProgrammingError as e:
        if e.args and e.args[0] == 1146:
            return
        raise

    if not articles:
        return
    if not stocks:
        print(
            "[news_stock_rel] stocks 테이블에 종목 행이 없습니다. "
            "시세 동기화(Live_price) 등으로 stocks를 채운 뒤 /api/rss/news 를 다시 호출하세요."
        )
        return

    stocks.sort(key=lambda s: len((s.get("name_ko") or "").strip()), reverse=True)
    sym_to_row = {str(s["symbol"]).strip(): s for s in stocks if s.get("symbol")}

    rel_sql = """
        INSERT INTO news_stock_rel (news_id, stock_id, match_type, confidence, created_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON DUPLICATE KEY UPDATE
            match_type = VALUES(match_type),
            confidence = VALUES(confidence)
    """

    with conn.cursor() as cur:
        for art in articles:
            nid = art.get("news_id")
            text = f"{art.get('title') or ''} {art.get('summary') or ''}"
            if not str(text).strip():
                continue
            seen: set[int] = set()
            for m in _CODE_6.finditer(text):
                row = sym_to_row.get(m.group(1))
                if not row:
                    continue
                sid = int(row["stock_id"])
                if sid in seen:
                    continue
                seen.add(sid)
                try:
                    cur.execute(rel_sql, (nid, sid, "TICKER", 0.95))
                except ProgrammingError as pe:
                    if pe.args and pe.args[0] == 1146:
                        return
                    raise
            for s in stocks:
                nk = (s.get("name_ko") or "").strip()
                if len(nk) < 2:
                    continue
                if nk in text:
                    sid = int(s["stock_id"])
                    if sid in seen:
                        continue
                    seen.add(sid)
                    try:
                        cur.execute(rel_sql, (nid, sid, "NLP", 0.72))
                    except ProgrammingError as pe:
                        if pe.args and pe.args[0] == 1146:
                            return
                        raise
