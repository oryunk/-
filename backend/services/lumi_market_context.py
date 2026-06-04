"""루미 챗봇용 시장·종목 스냅샷 (가벼운 컨텍스트 주입)."""

from __future__ import annotations

import re
import time
from typing import Literal

OutlookIntent = Literal["today_market", "stock_today", "stock_outlook", "general"]

_TODAY_MARKET_RE = re.compile(
    r"(오늘|지금|금일|장중|개장|마감|코스피|코스닥|지수|시장|장분위기|외인|기관|"
    r"매수|매도|급락|급등|폭락|폭등|개판)",
    re.I,
)
_FUTURE_RE = re.compile(
    r"(내일|모레|다음주|전망|예상|갈\s*꺼|갈거|오를|오를거|내릴|내릴거|될\s*것|될거|어떨\s*거)",
    re.I,
)
_STOCK_OUTLOOK_RE = re.compile(
    r"(어때|어떨|어떻게\s*보|괜찮|좋을|나쁠|살\s*만|살만|추천|정배|뇌피셜)",
    re.I,
)


def detect_outlook_intent(message: str) -> OutlookIntent:
    """오늘 장/지수 vs 종목+오늘 vs 종목 전망 vs 일반."""
    msg = (message or "").strip()
    if not msg:
        return "general"

    stock = _resolve_stock_name(msg)
    has_today = bool(_TODAY_MARKET_RE.search(msg))
    has_future = bool(_FUTURE_RE.search(msg))
    has_stock_q = bool(_STOCK_OUTLOOK_RE.search(msg)) or has_future

    if stock:
        if has_today:
            return "stock_today"
        if has_future or has_stock_q:
            return "stock_outlook"
        return "stock_outlook"

    if has_today or re.search(r"(코스피|코스닥|지수|시장)", msg, re.I):
        return "today_market"

    return "general"


def intent_needs_snapshot(intent: OutlookIntent) -> bool:
    return intent in ("today_market", "stock_today")


def build_market_snapshot(intent: OutlookIntent, message: str) -> str:
    """GPT에 붙일 짧은 스냅샷 텍스트. 실패 시 빈 문자열."""
    if not intent_needs_snapshot(intent):
        return ""

    parts: list[str] = []
    stock_name = _resolve_stock_name(message) if intent.startswith("stock") else None

    if intent in ("today_market", "stock_today"):
        index_block = _indices_snapshot_block()
        if index_block:
            parts.append(index_block)

    if stock_name and intent == "stock_today":
        quote_block = _stock_quote_block(stock_name)
        if quote_block:
            parts.append(quote_block)
        news_block = _stock_news_block(stock_name)
        if news_block:
            parts.append(news_block)

    if not parts:
        return ""
    return "\n".join(parts)


def format_user_message_with_snapshot(message: str, snapshot: str) -> str:
    msg = (message or "").strip()[:2000]
    snap = (snapshot or "").strip()
    if not snap:
        return msg
    return f"[오늘 시장 스냅샷]\n{snap}\n\n[질문]\n{msg}"


def _resolve_stock_name(message: str) -> str | None:
    try:
        import app as app_module
    except Exception:
        return None

    msg = (message or "").strip()
    if not msg:
        return None

    for candidate in _stock_name_candidates(msg):
        items = app_module._matched_stock_catalog_items(candidate, max_items=1)
        if items:
            name = str(items[0].get("name") or "").strip()
            if name:
                return name
    return None


def _stock_name_candidates(message: str) -> list[str]:
    """긴 구문부터 카탈로그 매칭 시도."""
    msg = re.sub(r"[^\w가-힣\s]", " ", message)
    msg = re.sub(r"\s+", " ", msg).strip()
    if not msg:
        return []

    stop = {
        "오늘", "내일", "어때", "어떨", "전망", "주식", "종목", "추천", "정배",
        "갈꺼", "오를", "내릴", "코스피", "코스닥", "시장", "지수", "루미",
        "뇌피셜", "같애", "같아", "보니", "개판",
    }
    words = [w for w in msg.split() if len(w) >= 2 and w not in stop]
    candidates = []
    if len(msg) >= 2:
        candidates.append(msg)
    for n in (3, 2):
        for i in range(len(words) - n + 1):
            phrase = " ".join(words[i : i + n])
            if len(phrase) >= 2:
                candidates.append(phrase)
    for w in words:
        candidates.append(w)

    seen: set[str] = set()
    out: list[str] = []
    for c in candidates:
        key = c.lower()
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def _ensure_index_cache() -> None:
    from app_state import _INDEX_CACHE, _INDEX_CACHE_TTL

    now = time.time()
    if _INDEX_CACHE.get("data") and (now - float(_INDEX_CACHE.get("ts") or 0)) < _INDEX_CACHE_TTL:
        return
    try:
        import app as app_module

        with app_module.app.test_request_context("/"):
            app_module.serve_market_indices()
    except Exception:
        pass


def _indices_snapshot_block() -> str:
    _ensure_index_cache()
    from app_state import _INDEX_CACHE

    rows = list(_INDEX_CACHE.get("data") or [])[:3]
    if not rows:
        return ""

    lines = ["[지수]"]
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        if row.get("error"):
            continue
        value_text = str(row.get("value_text") or row.get("value") or "").strip()
        change_text = str(row.get("change_text") or row.get("change") or "").strip()
        if value_text or change_text:
            lines.append(f"- {name}: {value_text} {change_text}".strip())
    return "\n".join(lines) if len(lines) > 1 else ""


def _stock_quote_block(stock_name: str) -> str:
    try:
        import app as app_module

        price, rate = app_module._db_quote_for_analysis(stock_name)
        if price <= 0:
            return ""
        sign = "+" if rate >= 0 else ""
        return f"[종목 시세] {stock_name}: {int(price):,}원 ({sign}{rate:.2f}%)"
    except Exception:
        return ""


def _stock_news_block(stock_name: str) -> str:
    try:
        import app as app_module

        news = app_module._pick_representative_news(stock_name)
        if not news:
            return ""
        title = str(news.get("title") or "").strip()
        if not title:
            return ""
        summary = str(news.get("summary") or "").strip()
        if summary and len(summary) > 120:
            summary = summary[:117] + "..."
        line = f"[관련 뉴스] {title}"
        if summary:
            line += f" — {summary}"
        return line
    except Exception:
        return ""
