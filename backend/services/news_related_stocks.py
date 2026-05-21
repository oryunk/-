"""뉴스 기사 관련 종목 추출(GPT) 및 시세 보강."""

from __future__ import annotations

import json
import re
from typing import Any

from app_state import DEFAULT_GPT_MODEL
from price import STOCKS as PRICE_STOCKS
from services.gpt_client import call_gpt

_CODE_6 = re.compile(r"(?<!\d)(\d{6})(?!\d)")
_MAX_RELATED = 2
_MARKET_CODES: frozenset[str] | None = None


def _market_codes() -> frozenset[str]:
    """price.STOCKS(주린 시장)에 등록된 6자리 종목코드."""
    global _MARKET_CODES
    if _MARKET_CODES is None:
        _MARKET_CODES = frozenset(
            str(c).strip()
            for c in (PRICE_STOCKS or {}).keys()
            if len(str(c).strip()) == 6 and str(c).strip().isdigit()
        )
    return _MARKET_CODES


def _is_market_stock_code(code: str) -> bool:
    c = re.sub(r"\D", "", str(code or ""))
    return len(c) == 6 and c in _market_codes()


def _filter_to_market_stocks(stocks: list[dict], limit: int = _MAX_RELATED) -> list[dict]:
    """우리 시장(등록 종목)만 남기고 0~limit개."""
    out: list[dict] = []
    seen: set[str] = set()
    for s in stocks or []:
        if not isinstance(s, dict):
            continue
        code = re.sub(r"\D", "", str(s.get("code") or ""))
        if not _is_market_stock_code(code) or code in seen:
            continue
        seen.add(code)
        name = str(s.get("name") or "").strip() or str(PRICE_STOCKS.get(code) or code)
        out.append({"code": code, "name": name[:40]})
        if len(out) >= limit:
            break
    return out


def _extract_first_json_object(text: str) -> dict | None:
    raw = str(text or "").strip()
    if not raw:
        return None
    m = re.search(r"```json\s*(\{[\s\S]*?\})\s*```", raw, flags=re.IGNORECASE)
    if m:
        try:
            obj = json.loads(m.group(1))
            return obj if isinstance(obj, dict) else None
        except Exception:
            pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(raw[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except Exception:
            pass
    return None


def _normalize_stock_entry(raw: dict) -> dict | None:
    code = re.sub(r"\D", "", str(raw.get("code") or ""))
    if not _is_market_stock_code(code):
        return None
    name = str(raw.get("name") or "").strip() or str(PRICE_STOCKS.get(code) or code)
    return {"code": code, "name": name[:40]}


def _parse_stocks_json_blob(blob: str | None) -> list[dict]:
    if not blob or not str(blob).strip():
        return []
    try:
        data = json.loads(blob)
    except Exception:
        return []
    items = data if isinstance(data, list) else (data.get("stocks") if isinstance(data, dict) else [])
    if not isinstance(items, list):
        return []
    out = []
    seen = set()
    for it in items:
        if not isinstance(it, dict):
            continue
        row = _normalize_stock_entry(it)
        if not row or row["code"] in seen:
            continue
        seen.add(row["code"])
        out.append(row)
        if len(out) >= _MAX_RELATED:
            break
    return _filter_to_market_stocks(out, limit=_MAX_RELATED)


def fetch_related_stocks_from_db_rel(conn, news_id: int, limit: int = _MAX_RELATED) -> list[dict]:
    """news_stock_rel 에 이미 연결된 종목."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.symbol, s.name_ko
                FROM news_stock_rel r
                INNER JOIN stocks s ON s.stock_id = r.stock_id
                WHERE r.news_id = %s
                ORDER BY r.confidence DESC, r.news_id DESC
                LIMIT %s
                """,
                (int(news_id), limit),
            )
            rows = cur.fetchall() or []
    except Exception:
        return []
    out = []
    seen = set()
    for row in rows:
        code = re.sub(r"\D", "", str(dict(row).get("symbol") or ""))
        if not _is_market_stock_code(code) or code in seen:
            continue
        seen.add(code)
        name = str(dict(row).get("name_ko") or "").strip() or str(PRICE_STOCKS.get(code) or code)
        out.append({"code": code, "name": name})
    return _filter_to_market_stocks(out, limit=limit)


def _stocks_from_title_summary(title: str, summary: str, stocks_catalog: list[tuple[str, str]]) -> list[dict]:
    """제목·요약에 등장하는 종목명/코드 매칭 (GPT 없을 때 보조)."""
    text = f"{title or ''} {summary or ''}"
    if not text.strip():
        return []
    out = []
    seen = set()
    for code, name in sorted(stocks_catalog, key=lambda x: len(x[1] or ""), reverse=True):
        if not name or len(name) < 2:
            continue
        if name in text and code not in seen:
            seen.add(code)
            out.append({"code": code, "name": name})
        if len(out) >= _MAX_RELATED:
            break
    if len(out) < _MAX_RELATED:
        for m in _CODE_6.finditer(text):
            code = m.group(1)
            if code in seen or not _is_market_stock_code(code):
                continue
            seen.add(code)
            out.append({"code": code, "name": str(PRICE_STOCKS.get(code) or code)})
            if len(out) >= _MAX_RELATED:
                break
    return _filter_to_market_stocks(out, limit=_MAX_RELATED)


def analyze_related_stocks_gpt(title: str, summary: str) -> dict:
    """GPT로 관련 국내 종목 JSON 추출."""
    body = (summary or "").strip()
    if len(body) > 2800:
        body = body[:2800] + "…"
    prompt = (
        "아래 한국 경제·증시 뉴스와 직접 관련된 국내 상장 종목만 골라라.\n\n"
        f"[제목]\n{title}\n\n[요약]\n{body}\n\n"
        "[출력 형식]\n"
        "반드시 JSON 한 개만 출력한다. 다른 설명 금지.\n"
        '{"stocks":[{"code":"6자리종목코드","name":"한글종목명"}, ...]}\n\n'
        "[규칙]\n"
        "- 0~2개. 직접 연관된 종목이 없으면 {\"stocks\":[]} 만 출력.\n"
        "- 주린닷컴 시장에 있는 KOSPI/KOSDAQ 상장 종목(6자리 코드)만. 해외·ETF·상장폐지·없는 코드 금지.\n"
        "- 1개만 연관되면 1개만. 억지로 2개 채우지 말 것.\n"
        "- 기사에 나오거나 강하게 연관된 종목만. 무관한 대형주 나열 금지.\n"
        "- 매수·매도 권유 문구 없음.\n"
    )
    return call_gpt(prompt, model=DEFAULT_GPT_MODEL)


def enrich_stocks_with_live_quotes(stocks: list[dict]) -> list[dict]:
    """Live_price 스냅샷으로 현재가·등락률 보강."""
    if not stocks:
        return []
    codes = [s["code"] for s in stocks if s.get("code")]
    snap: dict = {}
    try:
        from Live_price import fetch_live_snapshot_batch

        if fetch_live_snapshot_batch and codes:
            snap = fetch_live_snapshot_batch(codes) or {}
    except Exception:
        snap = {}

    out = []
    for s in stocks:
        code = s.get("code") or ""
        row = snap.get(code) or {}
        try:
            price = int(float(row.get("price") or 0))
        except (TypeError, ValueError):
            price = 0
        try:
            rate = round(float(row.get("rate") or 0), 2)
        except (TypeError, ValueError):
            rate = 0.0
        direction = str(row.get("direction") or "flat").lower()
        if direction not in ("up", "down", "flat"):
            direction = "up" if rate > 0.05 else ("down" if rate < -0.05 else "flat")
        out.append(
            {
                "code": code,
                "name": s.get("name") or code,
                "price": price,
                "rate": rate,
                "direction": direction,
            }
        )
    return out


def build_news_related_stocks(
    conn,
    news_id: int,
    title: str,
    summary: str,
    *,
    cached_json: str | None = None,
    use_gpt: bool = True,
) -> tuple[list[dict], str | None]:
    """
    관련 종목 목록 + DB 저장용 JSON 문자열.
    cached_json 이 있으면 재사용 후 시세만 갱신.
    """
    stocks: list[dict] = []
    if cached_json:
        stocks = _filter_to_market_stocks(_parse_stocks_json_blob(cached_json))

    if not stocks and conn and news_id:
        stocks = fetch_related_stocks_from_db_rel(conn, news_id)

    if not stocks and use_gpt:
        gpt = analyze_related_stocks_gpt(title, summary)
        if gpt.get("success"):
            obj = _extract_first_json_object(gpt.get("text") or "") or {}
            raw_list = obj.get("stocks") if isinstance(obj, dict) else []
            gpt_rows: list[dict] = []
            if isinstance(raw_list, list):
                for it in raw_list:
                    if isinstance(it, dict):
                        row = _normalize_stock_entry(it)
                        if row:
                            gpt_rows.append(row)
            stocks = _filter_to_market_stocks(gpt_rows)

    if not stocks:
        catalog = [(c, n) for c, n in PRICE_STOCKS.items() if _is_market_stock_code(str(c))]
        stocks = _stocks_from_title_summary(title, summary, catalog)

    deduped = _filter_to_market_stocks(stocks, limit=_MAX_RELATED)
    enriched = enrich_stocks_with_live_quotes(deduped)
    blob = json.dumps({"stocks": enriched}, ensure_ascii=False) if enriched else None
    return enriched, blob
