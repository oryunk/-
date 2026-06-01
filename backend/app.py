"""
주식/뉴스 웹앱 메인 Flask 앱.

- 공유 상태: `app_state` (명시 import — Pylance/정적 분석용)
- HTTP 라우트: `blueprints/*` + 아래 레거시 `serve_*` 등록
- 구현 본문: 분석·모의투자·지수·FX·차트·종목상세·실시간 시세·KIS 연동 헬퍼

설명( 점진적으로 라우트는 blueprints 로 옮기고, 무거운 로직은 services 로 이전 중이다. )
"""
from flask import Flask, request, jsonify, session, current_app
import yfinance as yf
import pandas as pd
from datetime import date, datetime, timedelta
import os
import time
import math
import json
import re
from urllib.parse import quote
import threading
from concurrent.futures import ThreadPoolExecutor, wait
import requests
import logging
from decimal import Decimal, ROUND_HALF_UP
from runtime_config import load_env_files, flask_secret_key, flask_run_options

# yfinance 내부 에러 로그(종목 없음, JSON 파싱 등) 터미널 출력 억제
logging.getLogger('yfinance').setLevel(logging.CRITICAL)

try:
    from pykrx import stock as pykrx_stock
except Exception as pykrx_err:
    print(f'[WARN] pykrx 로드 실패: {pykrx_err}')
    pykrx_stock = None

try:
    from Live_price import sync_live_price_batch, fetch_live_snapshot_batch
except Exception as live_price_err:
    print(f'[WARN] Live_price DB sync 로드 실패: {live_price_err}')
    sync_live_price_batch = None
    fetch_live_snapshot_batch = None

load_env_files()

from app_state import (
    DEFAULT_GPT_MODEL,
    LIVE_PRICE_STOCKS,
    LOCAL_TERM_FALLBACK,
    MASTER_PROMPT,
    PRICE_STOCKS,
    STOCK_CODES,
    TERM_INTERPRETATION_PROMPT,
    _AI_ANALYSIS_PERSIST_DB,
    _ASKING_FETCH_SERIAL_LOCK,
    _ASKING_PRICE_CACHE,
    _ASKING_PRICE_CACHE_LOCK,
    _ASKING_PRICE_CACHE_TTL,
    _ASKING_STALE_FALLBACK_SEC,
    _BASIC_PEER_CACHE,
    _BASIC_PEER_CACHE_TTL,
    _CHART_MIN_BARS,
    _CHART_PERIOD_MAP,
    _CHART_TARGET_BARS,
    _CHART_USE_KIS,
    _CHART_WINDOW_CAL_DAYS,
    _FX_USD_KRW_CACHE,
    _FX_USD_KRW_TTL,
    _INDEX_CACHE,
    _INDEX_CACHE_TTL,
    _INDEX_HISTORY_CACHE,
    _INDEX_HISTORY_TTL,
    _INDEX_KEY_META,
    _INDEX_KEY_TO_NAME,
    _INDEX_KEY_TO_YF_TICKER,
    _INDEX_NAME_TO_KEY,
    _GLOBAL_MACRO_ROWS,
    _TICKER_DISPLAY_ORDER,
    _INDEX_YF_TICKERS,
    _INVESTOR_FLOW_CACHE,
    _INVESTOR_FLOW_CACHE_TTL,
    _KIS_ASKING_GAP_LOCK,
    _KIS_ASKING_LAST_CALL,
    _KIS_ASKING_MIN_GAP,
    _KIS_ASKING_SECOND_TR_GAP,
    _KIS_ASKING_SKIP_FB,
    _KIS_BASE,
    _KIS_INDEX_ROWS_FIXED,
    _KIS_INDEX_TR,
    _KIS_INDEX_TR_FB,
    _KIS_KEY,
    _KIS_SECRET,
    _KIS_TOKEN_CACHE,
    _KIS_TOKEN_DEADLINE,
    _KIS_TOKEN_FILE,
    _KIS_TOKEN_SAVED_AT,
    _KIS_TOKEN_USE_DB,
    _KIS_TR,
    _KIS_TR_ASK,
    _KIS_TR_ASK_FB,
    _KIS_TR_FB,
    _KR_MARKET_CLOSE_HHMM,
    _KR_MARKET_OPEN_HHMM,
    _LIVE_BG_ENABLED,
    _LIVE_BG_INTERVAL_SEC,
    _LIVE_BG_WORKER_STARTED,
    _LIVE_BLOCK_OFFHOURS_FETCH,
    _LIVE_EOD_FIX_ENABLED,
    _LIVE_EOD_FIX_HHMM,
    _LIVE_EOD_PYKRX_SKIP_DATE,
    _LIVE_EOD_WORKER_STARTED,
    _LIVE_LAST_UPDATE_AT,
    _LIVE_OFFHOURS_STALE_DAYS,
    _LIVE_OFFHOURS_USE_CACHE,
    _LIVE_OFFHOURS_YFINANCE,
    _LIVE_OFFHOURS_YF_BUDGET,
    _LIVE_PRICE_CACHE,
    _LIVE_PRICE_CURSOR,
    _LIVE_PRICE_DB_SYNC_ENABLED,
    _LIVE_PRICE_LOCK,
    _LIVE_UPDATER_RUNNING,
    _MOCK_INITIAL_CASH,
    _PRICE_NAME_TO_CODE,
    _SECTOR_FULL_REFRESH_GUARD,
    _STOCK_DETAIL_CACHE,
    _STOCK_DETAIL_CACHE_TTL,
    _STOCK_DETAIL_DB_TTL,
    _STOCK_POPULARITY_ON_ANALYSIS,
    _WEB_PRICE_MAX_COUNT,
    _WEB_REFRESH_BATCH_SIZE,
    _WEB_REQUEST_GAP_SEC,
    _WEB_UPDATE_INTERVAL_SEC,
    _WEB_WARMUP_BATCH_SIZE,
)

app = Flask(__name__)
app.secret_key = flask_secret_key()
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_PATH"] = "/"

from auth_api import auth_bp, get_connection as get_db_connection
from cors_helpers import register_flask_cors
import kis_token_db

app.register_blueprint(auth_bp)
register_flask_cors(app)

from services.gpt_client import call_gpt, clean_gpt_prose as _clean_gpt_prose
from blueprints.news import news_bp
from blueprints.market_data import market_data_bp
from blueprints.mock_trading import mock_trading_bp
from blueprints.analysis import analysis_bp
from blueprints.charts import charts_bp
from blueprints.quotes import quotes_bp
from blueprints.static_site import static_site_bp
from blueprints.watchlist import watchlist_bp
from blueprints.lumi_chat import lumi_chat_bp

app.register_blueprint(news_bp)
app.register_blueprint(market_data_bp)
app.register_blueprint(mock_trading_bp)
app.register_blueprint(analysis_bp)
app.register_blueprint(charts_bp)
app.register_blueprint(quotes_bp)
app.register_blueprint(static_site_bp)
app.register_blueprint(watchlist_bp)
app.register_blueprint(lumi_chat_bp)

# 라이브 시세 유니버스: stock_popularity 기반 일별 순서 (짧은 TTL 캐시).
_LIVE_UNIVERSE_CACHE_ITEMS = None
_LIVE_UNIVERSE_CACHE_TS = 0.0
_LIVE_UNIVERSE_TTL = float(os.getenv('LIVE_PRICE_UNIVERSE_CACHE_TTL_SEC', '60'))

# 국내 주식 카탈로그: 검색/자동완성/유니버스 fallback용 TTL 캐시.
_STOCK_CATALOG_CACHE_ITEMS = None
_STOCK_CATALOG_CACHE_TS = 0.0
_STOCK_CATALOG_TTL = float(os.getenv('STOCK_CATALOG_CACHE_TTL_SEC', '120'))


# 로컬 용어 사전·고정 안내 문구로 용어를 설명한다 (GPT 없을 때).
# 설명( `/api/explain-term` 등에서 GPT 실패·비활성 시 fallback. )
def explain_term_with_local_fallback(term_name):
    normalized = (term_name or '').strip().lower()
    if normalized in LOCAL_TERM_FALLBACK:
        return LOCAL_TERM_FALLBACK[normalized]

    return (
        f"{term_name}은(는) 투자 공부를 하다 보면 자주 나오는 개념이에요.\n\n"
        '지금은 AI 설명을 잠시 쓸 수 없어 짧게만 안내해요. '
        f'"{term_name}"의 정의·쓰임은 용어 사전 카드나 시장 화면의 힌트를 함께 보면 이해가 빨라요.'
    )


# 차트 API(/api/chart-data/<code>)용 코드. 한국 6자리면 숫자만, 그 외는 yfinance 티커 그대로.
def _resolve_chart_code(stock_name):
    """차트 API(/api/chart-data/<code>)용 코드. 한국 6자리면 숫자만, 그 외는 yfinance 티커 그대로."""
    _ticker, chart_code = _resolve_ticker_and_chart_code(stock_name)
    return chart_code


# 사용자 입력(한글명/6자리코드/티커)을 yfinance ticker + 차트코드로 해석.
# 설명( - 한글명은 최신 stocks 카탈로그 우선, 없으면 기존 STOCK_CODES/price.STOCKS 역매핑을 사용한다. - 6자리 숫자는 시장에 따라 .KS/.KQ 를 붙인다. )
def _resolve_ticker_and_chart_code(stock_name):
    """
    사용자 입력(한글명/6자리코드/티커)을 yfinance ticker + 차트코드로 해석.
    - 한글명은 최신 stocks 카탈로그 우선, 없으면 STOCK_CODES + price.STOCKS 역매핑으로 6자리 코드를 찾는다.
    - 6자리 숫자는 시장에 따라 .KS/.KQ 를 붙인다.
    """
    raw = (stock_name or '').strip()
    if not raw:
        return '', ''

    if raw in STOCK_CODES:
        ticker = STOCK_CODES[raw]
        chart_code = ticker.split('.')[0] if isinstance(ticker, str) and '.' in ticker else str(ticker)
        return str(ticker), str(chart_code)

    catalog_item = _resolve_catalog_item_for_input(raw)
    if catalog_item:
        code = str(catalog_item.get('code') or '').strip()
        market = str(catalog_item.get('market') or '').strip().upper()
        if code and re.match(r'^\d{6}$', code):
            suffix = '.KQ' if market == 'KOSDAQ' else '.KS'
            return f'{code}{suffix}', code

    if len(raw) == 6 and raw.isdigit():
        return f'{raw}.KS', raw

    normalized = raw.replace(' ', '').lower()
    mapped_code = _PRICE_NAME_TO_CODE.get(raw.lower()) or _PRICE_NAME_TO_CODE.get(normalized)
    if mapped_code and len(mapped_code) == 6 and mapped_code.isdigit():
        return f'{mapped_code}.KS', mapped_code

    if re.fullmatch(r'[A-Za-z][A-Za-z0-9._-]*', raw):
        return raw.upper(), raw.upper()

    return raw, raw


# NaN/inf/None 을 기본값으로 치환해 JSON 직렬화 오류를 방지.
def _safe_float(value, default=0.0):
    """NaN/inf/None 을 기본값으로 치환해 JSON 직렬화 오류를 방지."""
    try:
        num = float(value)
    except Exception:
        return float(default)
    if pd.isna(num) or num in (float('inf'), float('-inf')):
        return float(default)
    return num


# GPT 텍스트에서 첫 JSON 객체를 추출해 dict로 반환.
def _extract_first_json_object(text):
    """GPT 텍스트에서 첫 JSON 객체를 추출해 dict로 반환."""
    raw = str(text or "").strip()
    if not raw:
        return None

    # 1) ```json ... ``` 블록 우선
    m = re.search(r"```json\s*(\{[\s\S]*?\})\s*```", raw, flags=re.IGNORECASE)
    if m:
        try:
            obj = json.loads(m.group(1))
            return obj if isinstance(obj, dict) else None
        except Exception:
            pass

    # 2) 일반 텍스트에서 첫 { ... } 구간 탐색
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(raw[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


# `_coerce_gpt_opinion` — 모듈 내부 헬퍼.
def _coerce_gpt_opinion(value, fallback):
    allowed = {"강력매수", "매수", "보유", "약세"}
    v = str(value or "").strip()
    if v in allowed:
        return v
    return fallback


# `_opinion_to_color` — 모듈 내부 헬퍼.
def _opinion_to_color(opinion):
    if opinion == "강력매수":
        return "green"
    if opinion == "매수":
        return "light-green"
    if opinion == "약세":
        return "red"
    return "gray"


def _normalize_target_price_for_opinion(current_price, target_price, opinion):
    """AI 의견과 목표가 방향이 엇갈리지 않도록 최소 방향성을 정규화한다."""
    cur = _safe_float(current_price, 0.0)
    tgt = _safe_float(target_price, cur if cur > 0 else 0.0)
    if cur <= 0:
        return round(max(tgt, 0), 0)
    if tgt <= 0:
        tgt = cur

    if opinion == "강력매수":
        tgt = max(tgt, cur * 1.04)
    elif opinion == "매수":
        tgt = max(tgt, cur * 1.015)
    elif opinion == "약세":
        tgt = min(tgt, cur * 0.985)
    else:
        tgt = min(max(tgt, cur * 0.99), cur * 1.01)

    return round(tgt, 0)


# 분석 API용 현재가/등락률 DB fallback.
# 설명( - yfinance 실패 시에도 DB 스냅샷으로 0원 응답을 피한다. )
def _db_quote_for_analysis(stock_name):
    """
    분석 API용 현재가/등락률 DB fallback.
    - yfinance 실패 시에도 DB 스냅샷으로 0원 응답을 피한다.
    """
    if not fetch_live_snapshot_batch:
        return 0, 0.0
    try:
        _, chart_code = _resolve_ticker_and_chart_code(stock_name)
        code = str(chart_code or "").strip()
        if not (len(code) == 6 and code.isdigit()):
            return 0, 0.0
        snap = fetch_live_snapshot_batch([code]) or {}
        row = snap.get(code) or {}
        price = int(_safe_float(row.get("price"), 0))
        rate = _safe_float(row.get("rate"), 0.0)
        if price > 0:
            return price, rate
    except Exception:
        pass
    return 0, 0.0


# 종목 관련 최신 대표 뉴스 1건을 선택.
def _pick_representative_news(stock_name):
    """종목 관련 최신 대표 뉴스 1건을 선택."""
    name = str(stock_name or '').strip()
    code = _resolve_stock_code_for_news(stock_name)
    if not name and not code:
        return None
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            rows = []
            if name:
                like_name = f"%{name}%"
                cursor.execute(
                    """
                    SELECT news_id, title, summary, source, published_at
                    FROM news_articles
                    WHERE title LIKE %s OR summary LIKE %s
                    ORDER BY published_at DESC, news_id DESC
                    LIMIT 5
                    """,
                    (like_name, like_name),
                )
                rows = cursor.fetchall() or []
            if not rows and code:
                like_code = f"%{code}%"
                cursor.execute(
                    """
                    SELECT news_id, title, summary, source, published_at
                    FROM news_articles
                    WHERE title LIKE %s OR summary LIKE %s
                    ORDER BY published_at DESC, news_id DESC
                    LIMIT 5
                    """,
                    (like_code, like_code),
                )
                rows = cursor.fetchall() or []
        if not rows:
            return None
        row = dict(rows[0])
        return {
            'news_id': row.get('news_id'),
            'title': str(row.get('title') or '').strip(),
            'summary': str(row.get('summary') or '').strip(),
            'source': str(row.get('source') or '').strip(),
            'published_at': str(row.get('published_at') or ''),
        }
    except Exception:
        return None
    finally:
        if conn:
            conn.close()


# `_resolve_stock_code_for_news` — 모듈 내부 헬퍼.
def _resolve_stock_code_for_news(stock_name):
    _, chart_code = _resolve_ticker_and_chart_code(stock_name)
    code = str(chart_code or '').strip()
    if len(code) == 6 and code.isdigit():
        return code
    return ''


# 대표 뉴스 1건을 기반으로 -1.0~1.0 감성 점수 산출.
# 설명( GPT 실패 시 키워드 휴리스틱 fallback. )
def _news_sentiment_score(stock_name, article):
    """
    대표 뉴스 1건을 기반으로 -1.0~1.0 감성 점수 산출.
    GPT 실패 시 키워드 휴리스틱 fallback.
    """
    if not article:
        return 0.0, ''

    title = str(article.get('title') or '').strip()
    summary = str(article.get('summary') or '').strip()
    if len(summary) > 1500:
        summary = summary[:1500] + '...'

    prompt = (
        "아래 뉴스가 해당 종목의 1~3개월 주가 기대에 주는 영향을 평가하라.\n"
        "반드시 첫 줄에 JSON만 출력하라.\n"
        "JSON 스키마: {\"sentiment_score\": -1.0~1.0 숫자, \"rationale\":\"한국어 한 문장\"}\n\n"
        f"[종목]\n{stock_name}\n\n"
        f"[뉴스 제목]\n{title}\n\n"
        f"[뉴스 요약]\n{summary}\n"
    )
    gpt_result = call_gpt(prompt, model=DEFAULT_GPT_MODEL)
    if gpt_result.get('success'):
        obj = _extract_first_json_object(gpt_result.get('text', '')) or {}
        score = _safe_float(obj.get('sentiment_score'), 0.0)
        score = _clamp(score, -1.0, 1.0)
        rationale = str(obj.get('rationale') or '').strip()
        return score, rationale

    text = f"{title}\n{summary}"
    pos = ('수주', '호실적', '성장', '상승', '개선', '흑자', '신제품', '확대', '증가')
    neg = ('적자', '하향', '감소', '리스크', '규제', '소송', '부진', '악화', '감원')
    p = sum(1 for w in pos if w in text)
    n = sum(1 for w in neg if w in text)
    raw = (p - n) / 6.0
    return _clamp(raw, -1.0, 1.0), '뉴스 키워드 기반 보조 점수'


# `_clamp` — 모듈 내부 헬퍼.
def _clamp(value, low, high):
    return max(low, min(high, value))


def _mock_exec_strength_metrics(code, volume=0, change_rate=None, direction=None):
    """체결강도(%) = 매수 체결량 / 매도 체결량 × 100 (모의 추정, 실시간 체결분리 미연동)."""
    seed = sum(int(d) for d in str(code) if d.isdigit()) + date.today().toordinal()
    rng = (seed * 1103515245 + 12345) & 0x7FFFFFFF
    vol_base = max(5000, int(volume or 0) // 8 + 10000 + (rng % 90000))
    sell_vol = max(1000, int(vol_base * (0.42 + ((rng >> 8) % 48) / 100.0)))
    strength_target = 68 + ((rng >> 16) % 82)  # 68~149% 목표

    direction_key = str(direction or '').strip().lower()
    try:
        cr = float(change_rate) if change_rate is not None else 0.0
    except (TypeError, ValueError):
        cr = 0.0

    if direction_key == 'up' or cr > 0.3:
        strength_target += 6 + min(22, int(abs(cr) * 3))
    elif direction_key == 'down' or cr < -0.3:
        strength_target -= 6 + min(22, int(abs(cr) * 3))

    strength_target = int(_clamp(round(strength_target), 58, 168))
    buy_vol = max(1, int(round(sell_vol * strength_target / 100.0)))
    exec_strength_pct = round(buy_vol / sell_vol * 100.0, 1)

    if exec_strength_pct > 100.5:
        exec_strength_side = 'buy'
        exec_strength_caption = '매수 체결이 더 많아요 (100% 초과)'
    elif exec_strength_pct < 99.5:
        exec_strength_side = 'sell'
        exec_strength_caption = '매도 체결이 더 많아요 (100% 미만)'
    else:
        exec_strength_side = 'neutral'
        exec_strength_caption = '매수·매도 체결이 비슷해요 (100% 근처)'

    return exec_strength_pct, exec_strength_side, exec_strength_caption


# 주식 데이터 조회
def get_stock_data(stock_name):
    """주식 데이터 조회"""
    try:
        ticker, _ = _resolve_ticker_and_chart_code(stock_name)
        if not ticker:
            return None

        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)

        data = yf.download(ticker, start=start_date, end=end_date,
                           progress=False, auto_adjust=True)

        # .KS 실패 시 .KQ 한 번만 재시도 (조용히)
        if data.empty and ticker.endswith('.KS'):
            alt = ticker.replace('.KS', '.KQ')
            data = yf.download(alt, start=start_date, end=end_date,
                               progress=False, auto_adjust=True)

        if data.empty:
            return None

        return data
    except Exception as e:
        print(f"[데이터 조회 오류] {e}")
        return None

# AI 종목 분석
def analyze_stock(stock_name):
    """AI 종목 분석"""
    data = get_stock_data(stock_name)
    db_price, db_rate = _db_quote_for_analysis(stock_name)
    rep_news = _pick_representative_news(stock_name)
    news_score, news_rationale = _news_sentiment_score(stock_name, rep_news)
    news_block = ""
    if rep_news:
        news_block = (
            f"\n[대표 뉴스]\n제목: {rep_news.get('title')}\n"
            f"요약: {rep_news.get('summary')}\n"
            f"뉴스 점수(-1~1): {news_score:.2f}\n"
        )

    # 시세 데이터 없이 GPT 직접 분석 경로
    if data is None:
        gpt_input = (
            f"{MASTER_PROMPT}\n\n"
            "--------------------------------------------------\n"
            f"[종목 데이터]\n종목: {stock_name}\n"
            "※ 현재 시세 데이터를 가져오지 못했습니다. 일반 공개 정보와 종목명 기반으로 분석하십시오.\n\n"
            f"{news_block}\n"
            "[출력 지시]\n"
            "- 반드시 첫 출력은 JSON 코드블록 하나로 시작한다.\n"
            "- JSON 스키마: {\"opinion\":\"강력매수|매수|보유|약세\", \"target_price\":정수, \"summary\":\"3~4문장 한국어 요약\"}\n"
            "- JSON 뒤에는 상세 분석 본문을 이어서 작성한다.\n"
            "- 한국어로 작성한다."
        )
        gpt_result = call_gpt(gpt_input)
        if gpt_result.get('success'):
            gpt_text = gpt_result.get('text', '')
            gpt_obj = _extract_first_json_object(gpt_text) or {}
            opinion = _coerce_gpt_opinion(gpt_obj.get('opinion'), "보유")
            target_price = round(_safe_float(gpt_obj.get('target_price'), 0), 0)
            if target_price <= 0 and db_price > 0:
                target_price = round(db_price * 1.02, 0)
            target_price = _normalize_target_price_for_opinion(db_price, target_price, opinion)
            summary = str(gpt_obj.get('summary') or '').strip() or f'【{stock_name}】 시세 데이터 없이 AI 텍스트 기반 분석을 제공합니다.'
            return {
                'success': True,
                'stock_name': stock_name,
                'chart_code': _resolve_chart_code(stock_name),
                'current_price': int(db_price) if db_price > 0 else 0,
                'change_rate': round(db_rate, 2) if db_price > 0 else 0,
                'ma_20': 0,
                'ma_60': 0,
                'volatility': 0,
                'opinion': opinion,
                'target_price': target_price,
                'summary': summary,
                'ai_analysis': gpt_text,
                'ai_model': DEFAULT_GPT_MODEL,
                'color': _opinion_to_color(opinion),
                'news_sentiment_score': round(news_score, 3),
                'news_sentiment_rationale': news_rationale,
                'representative_news': rep_news,
                'data_source': 'gpt-only'
            }
        return {
            'success': False,
            'message': f'종목 데이터 및 AI 분석 모두 실패했습니다: {gpt_result.get("message", "")}'
        }
    
    try:
        # 기본 통계
        current_price = _safe_float(data['Close'].iloc[-1], 0.0)
        if current_price <= 0 and db_price > 0:
            current_price = float(db_price)
        prev_price = _safe_float(data['Close'].iloc[-5], current_price) if len(data) >= 5 else _safe_float(data['Close'].iloc[0], current_price)
        change_rate = ((current_price - prev_price) / prev_price * 100) if prev_price != 0 else 0
        if abs(change_rate) < 1e-9 and db_price > 0:
            change_rate = db_rate
        
        # 이동평균선
        ma_20 = _safe_float(data['Close'].rolling(window=20).mean().iloc[-1], current_price)
        ma_60 = _safe_float(data['Close'].rolling(window=60).mean().iloc[-1], current_price)
        
        # 변동성
        volatility = _safe_float(data['Close'].pct_change().std() * 100, 0.0)
        
        # 거래량 추세
        avg_volume = _safe_float(data['Volume'].rolling(window=20).mean().iloc[-1], 0.0)
        current_volume = _safe_float(data['Volume'].iloc[-1], 0.0)
        volume_trend = "증가" if current_volume > avg_volume else "감소"
        
        # AI 분석 로직 (간단한 기술적 분석)
        signals = {
            'bullish': 0,
            'bearish': 0
        }
        
        # 시그널 1: 이동평균선
        if ma_20 > ma_60:
            signals['bullish'] += 1
        else:
            signals['bearish'] += 1
        
        # 시그널 2: 가격과 이동평균선
        if current_price > ma_20:
            signals['bullish'] += 1
        else:
            signals['bearish'] += 1
        
        # 시그널 3: 거래량 추세
        if volume_trend == "증가":
            signals['bullish'] += 0.5
        else:
            signals['bearish'] += 0.5
        
        # 시그널 4: 변동성 (낮을수록 안정적)
        if volatility < 3:
            signals['bullish'] += 0.5
        
        # 로컬 fallback 의견 결정
        if signals['bullish'] >= 2.5:
            opinion = "강력매수"
        elif signals['bullish'] >= 1.5:
            opinion = "매수"
        elif signals['bearish'] > signals['bullish']:
            opinion = "약세"
        else:
            opinion = "보유"
        color = _opinion_to_color(opinion)
        
        # 목표가 설정 (간단한 계산)
        target_price = current_price * (1 + change_rate/100 * 0.5)
        # 대표 뉴스 톤을 목표가에 소폭 반영 (과도 편향 방지)
        target_price *= (1 + (news_score * 0.06))
        target_price = _normalize_target_price_for_opinion(current_price, target_price, opinion)
        
        analysis_summary = f"""
【종목: {stock_name}】
현재가: {current_price:,.0f}원
변동률: {change_rate:+.2f}%

【기술적 분석】
• 20일 이동평균: {ma_20:,.0f}원
• 60일 이동평균: {ma_60:,.0f}원
• 변동성(일일): {volatility:.2f}%
• 거래량 추세: {volume_trend}

【AI 투자의견】
추천: {opinion}
목표가: {target_price:,.0f}원 (향후 3개월)

【분석 요약】
"""
        
        if opinion == "강력매수":
            analysis_summary += "기술적 지표상 강한 상승 신호입니다. 이동평균선의 정렬이 좋고 거래량 추세도 긍정적입니다. 단기 상승 가능성이 높습니다."
        elif opinion == "매수":
            analysis_summary += "약세한 상승 신호를 보이고 있습니다. 추가 상승 여력이 있을 것으로 예상됩니다."
        elif opinion == "약세":
            analysis_summary += "하락 신호가 강합니다. 현재는 관망하기를 권장합니다."
        else:
            analysis_summary += "현재 뚜렷한 방향성이 없습니다. 추가 변화를 관찰이 필요합니다."

        gpt_input = (
            f"{MASTER_PROMPT}\n\n"
            "--------------------------------------------------\n"
            f"[종목 데이터]\n종목: {stock_name}\n현재가: {current_price:,.0f}원\n변동률: {change_rate:+.2f}%\n"
            f"20일 MA: {ma_20:,.0f}원\n60일 MA: {ma_60:,.0f}원\n변동성: {volatility:.2f}%\n거래량 추세: {volume_trend}\n"
            f"댓글: {analysis_summary}\n"
            f"{news_block}\n"
            "[출력 지시]\n"
            "- 반드시 첫 출력은 JSON 코드블록 하나로 시작한다.\n"
            "- JSON 스키마: {\"opinion\":\"강력매수|매수|보유|약세\", \"target_price\":정수, \"summary\":\"3~4문장 한국어 요약\"}\n"
            "- target_price는 현재가 기준 3개월 관점의 합리적 목표가를 숫자로 제시한다.\n"
            "- JSON 뒤에는 상세 분석 본문을 이어서 작성한다.\n"
            "- 한국어로 작성한다."
        )

        gpt_result = call_gpt(gpt_input)
        gpt_text = gpt_result.get('text') if gpt_result.get('success') else f"GPT 호출 실패: {gpt_result.get('message')}"
        final_opinion = opinion
        final_target_price = target_price
        final_summary = analysis_summary
        final_color = color

        if gpt_result.get('success'):
            gpt_obj = _extract_first_json_object(gpt_text) or {}
            final_opinion = _coerce_gpt_opinion(gpt_obj.get('opinion'), opinion)
            final_target_price = _safe_float(gpt_obj.get('target_price'), target_price)
            if final_target_price <= 0:
                final_target_price = target_price
            final_target_price = final_target_price * (1 + (news_score * 0.03))
            final_target_price = _normalize_target_price_for_opinion(current_price, final_target_price, final_opinion)
            gpt_summary = str(gpt_obj.get('summary') or '').strip()
            if gpt_summary:
                final_summary = gpt_summary
            final_color = _opinion_to_color(final_opinion)
        else:
            final_target_price = _normalize_target_price_for_opinion(current_price, final_target_price, final_opinion)

        return {
            'success': True,
            'stock_name': stock_name,
            'chart_code': _resolve_chart_code(stock_name),
            'current_price': round(current_price, 0),
            'change_rate': round(change_rate, 2),
            'ma_20': round(ma_20, 0),
            'ma_60': round(ma_60, 0),
            'volatility': round(volatility, 2),
            'opinion': final_opinion,
            'target_price': round(final_target_price, 0),
            'summary': final_summary,
            'ai_analysis': gpt_text,
            'ai_model': DEFAULT_GPT_MODEL,
            'color': final_color,
            'news_sentiment_score': round(news_score, 3),
            'news_sentiment_rationale': news_rationale,
            'representative_news': rep_news,
        }
    
    except Exception as e:
        print(f"분석 오류: {e}")
        return {
            'success': False,
            'message': f'분석 중 오류가 발생했습니다: {str(e)}'
        }


# 금융/투자 용어를 GPT로 설명
def explain_term_with_gpt(term_name):
    """금융/투자 용어를 GPT로 설명"""
    prompt = (
        f"{TERM_INTERPRETATION_PROMPT}\n"
        f"[사용자 질문]\n{term_name}\n\n"
        "위는 단일 용어 질문이다. 질문한 용어만, 위 작성 규칙을 지켜 답하라."
    )
    return call_gpt(prompt, model=DEFAULT_GPT_MODEL)


# `_resolve_stock_id_for_analysis` — 모듈 내부 헬퍼.
def _resolve_stock_id_for_analysis(conn, stock_name: str):
    chart = _resolve_chart_code(stock_name)
    if not chart:
        return None
    code = str(chart).strip()
    if not re.match(r'^\d{6}$', code):
        return None
    with conn.cursor() as c:
        c.execute('SELECT stock_id FROM stocks WHERE symbol = %s LIMIT 1', (code,))
        r = c.fetchone()
        return int(r['stock_id']) if r else None


# `_bump_stock_popularity_on_analysis` — 모듈 내부 헬퍼.
def _bump_stock_popularity_on_analysis(conn, stock_id: int):
    if not _STOCK_POPULARITY_ON_ANALYSIS or stock_id <= 0:
        return
    with conn.cursor() as c:
        c.execute(
            """
            INSERT INTO stock_popularity (stock_id, date, view_count, search_count, trade_count)
            VALUES (%s, CURDATE(), 1, 1, 0)
            ON DUPLICATE KEY UPDATE
                view_count = view_count + 1,
                search_count = search_count + 1
            """,
            (stock_id,),
        )


def _catalog_display_name(code, name=''):
    clean_code = str(code or '').strip()
    clean_name = str(name or '').strip()
    return clean_name or PRICE_STOCKS.get(clean_code) or LIVE_PRICE_STOCKS.get(clean_code) or clean_code


def _fetch_active_domestic_stock_catalog():
    """국내 6자리 활성 종목 카탈로그(검색/자동완성 공통)."""
    global _STOCK_CATALOG_CACHE_ITEMS, _STOCK_CATALOG_CACHE_TS
    now = time.time()
    if (
        _STOCK_CATALOG_CACHE_ITEMS is not None
        and (now - _STOCK_CATALOG_CACHE_TS) < _STOCK_CATALOG_TTL
    ):
        return _STOCK_CATALOG_CACHE_ITEMS

    items = []
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT stock_id, symbol, name_ko, name_en, market
                FROM stocks
                WHERE is_active = 1
                  AND symbol REGEXP '^[0-9]{6}$'
                  AND (market IS NULL OR market = '' OR UPPER(market) IN ('KOSPI', 'KOSDAQ', 'KONEX'))
                ORDER BY stock_id ASC
                """
            )
            rows = cur.fetchall() or []
        seen = set()
        for row in rows:
            code = str(row.get('symbol') or '').strip().split('.')[0].strip()
            if not re.match(r'^\d{6}$', code) or code in seen:
                continue
            seen.add(code)
            items.append({
                'stock_id': row.get('stock_id'),
                'code': code,
                'name': _catalog_display_name(code, row.get('name_ko')),
                'name_en': str(row.get('name_en') or '').strip(),
                'market': str(row.get('market') or '').strip(),
            })
    except Exception as e:
        print(f'[stock-catalog] 조회 실패: {e}')
    finally:
        if conn:
            conn.close()

    if not items:
        seen = set()
        for code, name in PRICE_STOCKS.items():
            clean_code = str(code or '').strip().split('.')[0].strip()
            if not re.match(r'^\d{6}$', clean_code) or clean_code in seen:
                continue
            seen.add(clean_code)
            items.append({
                'stock_id': None,
                'code': clean_code,
                'name': _catalog_display_name(clean_code, name),
                'name_en': '',
                'market': '',
            })

    _STOCK_CATALOG_CACHE_ITEMS = items
    _STOCK_CATALOG_CACHE_TS = now
    return _STOCK_CATALOG_CACHE_ITEMS


def _searchable_stock_name(item):
    return ' '.join(
        part.strip()
        for part in (
            str((item or {}).get('name') or ''),
            str((item or {}).get('name_en') or ''),
        )
        if part and part.strip()
    ).strip()


def _normalize_catalog_stock_key(value) -> str:
    return str(value or '').strip().replace(' ', '').lower()


def _resolve_catalog_item_for_input(stock_input):
    raw = str(stock_input or '').strip()
    if not raw:
        return None
    normalized = _normalize_catalog_stock_key(raw)
    exact_code = raw if re.match(r'^\d{6}$', raw) else ''
    for item in _fetch_active_domestic_stock_catalog():
        code = str((item or {}).get('code') or '').strip()
        name = str((item or {}).get('name') or '').strip()
        name_en = str((item or {}).get('name_en') or '').strip()
        if exact_code and code == exact_code:
            return item
        if normalized and normalized in {
            _normalize_catalog_stock_key(name),
            _normalize_catalog_stock_key(name_en),
        }:
            return item
    return None


def _default_live_universe_items(limit: int) -> list[tuple[str, str]]:
    """기본 인기 순서 유니버스. price.STOCKS 우선순위를 따르고, 나머지는 카탈로그 순으로 잇는다."""
    catalog = _fetch_active_domestic_stock_catalog()
    catalog_by_code = {}
    for item in catalog:
        code = str((item or {}).get('code') or '').strip()
        if code and re.match(r'^\d{6}$', code):
            catalog_by_code[code] = item

    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    for code in PRICE_STOCKS.keys():
        clean_code = str(code or '').strip().split('.')[0].strip()
        if not re.match(r'^\d{6}$', clean_code) or clean_code in seen:
            continue
        item = catalog_by_code.get(clean_code)
        name = _catalog_display_name(clean_code, (item or {}).get('name'))
        out.append((clean_code, name))
        seen.add(clean_code)
        if len(out) >= limit:
            return out

    for item in catalog:
        code = str((item or {}).get('code') or '').strip()
        if not re.match(r'^\d{6}$', code) or code in seen:
            continue
        out.append((code, _catalog_display_name(code, item.get('name'))))
        seen.add(code)
        if len(out) >= limit:
            break
    return out


def _get_live_price_universe_items():
    """시장 기본 유니버스. 인기 집계가 충분하면 그 순서, 아니면 기본 인기 fallback 순서를 사용한다."""
    global _LIVE_UNIVERSE_CACHE_ITEMS, _LIVE_UNIVERSE_CACHE_TS
    now = time.time()
    if (
        _LIVE_UNIVERSE_CACHE_ITEMS is not None
        and (now - _LIVE_UNIVERSE_CACHE_TS) < _LIVE_UNIVERSE_TTL
    ):
        return _LIVE_UNIVERSE_CACHE_ITEMS

    limit = max(1, int(_WEB_PRICE_MAX_COUNT))
    fallback = _default_live_universe_items(limit)
    ranked: list[tuple[str, str]] = []
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.symbol, s.name_ko,
                           SUM(COALESCE(sp.view_count, 0) + COALESCE(sp.search_count, 0)
                               + COALESCE(sp.trade_count, 0)) AS score
                    FROM stock_popularity sp
                    INNER JOIN stocks s ON s.stock_id = sp.stock_id
                    WHERE sp.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    GROUP BY s.symbol, s.name_ko
                    ORDER BY score DESC, s.symbol ASC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall() or []
                if not rows:
                    cur.execute(
                        'SELECT MAX(date) AS d FROM stock_popularity WHERE date IS NOT NULL',
                    )
                    mx = cur.fetchone()
                    ref = mx.get('d') if mx else None
                    if ref is not None:
                        cur.execute(
                            """
                            SELECT s.symbol, s.name_ko,
                                   SUM(COALESCE(sp.view_count, 0) + COALESCE(sp.search_count, 0)
                                       + COALESCE(sp.trade_count, 0)) AS score
                            FROM stock_popularity sp
                            INNER JOIN stocks s ON s.stock_id = sp.stock_id
                            WHERE sp.date = %s
                            GROUP BY s.symbol, s.name_ko
                            ORDER BY score DESC, s.symbol ASC
                            LIMIT %s
                            """,
                            (ref, limit),
                        )
                        rows = cur.fetchall() or []
                for r in rows:
                    sym = str(r.get('symbol') or '').strip().split('.')[0].strip()
                    if not sym:
                        continue
                    nm = _catalog_display_name(sym, r.get('name_ko'))
                    ranked.append((sym, nm))
        finally:
            conn.close()
    except Exception as e:
        bc = getattr(e, 'args', None)
        if not (bc and bc[0] == 1146):
            logging.getLogger(__name__).warning('[live-universe] DB 조회 실패: %s', e)
        ranked = []

    ranked_is_reliable = len(ranked) >= min(limit, 18)
    if not ranked_is_reliable:
        ranked = []

    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for code, name in ranked:
        c = str(code).strip().split('.')[0].strip()
        if not c or c in seen:
            continue
        seen.add(c)
        nm = _catalog_display_name(c, name)
        out.append((c, nm))
        if len(out) >= limit:
            break
    for code, name in fallback:
        if len(out) >= limit:
            break
        c = str(code).strip().split('.')[0].strip()
        if not c or c in seen:
            continue
        seen.add(c)
        out.append((c, _catalog_display_name(c, name)))
    _LIVE_UNIVERSE_CACHE_ITEMS = out[:limit]
    _LIVE_UNIVERSE_CACHE_TS = now
    return _LIVE_UNIVERSE_CACHE_ITEMS


def _bump_stock_popularity_view(code: str):
    """시장 종목 상세 조회 시 당일 view_count 증가 (인기 순위 변동용)."""
    global _LIVE_UNIVERSE_CACHE_TS
    base = _chart_base_code(str(code or ''))
    if not base or not re.match(r'^\d{6}$', base):
        return
    try:
        sid = _chart_resolve_stock_id(base)
        if not sid:
            return
        conn = get_db_connection()
        try:
            with conn.cursor() as c:
                c.execute(
                    """
                    INSERT INTO stock_popularity (stock_id, date, view_count, search_count, trade_count)
                    VALUES (%s, CURDATE(), 1, 0, 0)
                    ON DUPLICATE KEY UPDATE
                        view_count = view_count + 1
                    """,
                    (sid,),
                )
            conn.commit()
            _LIVE_UNIVERSE_CACHE_TS = 0.0
        finally:
            conn.close()
    except Exception as e:
        bc = getattr(e, 'args', None)
        if not (bc and bc[0] == 1146):
            logging.getLogger(__name__).warning('[stock_popularity] view bump 실패: %s', e)


# `_persist_ai_analysis_row` — 모듈 내부 헬퍼.
def _persist_ai_analysis_row(result: dict, stock_name: str, user_id):
    if not _AI_ANALYSIS_PERSIST_DB or not result.get('success'):
        return
    try:
        conn = get_db_connection()
        try:
            stock_id = _resolve_stock_id_for_analysis(conn, stock_name)
            summary = str(result.get('summary') or '')[:65000]
            rating = (result.get('opinion') or '보유')[:50]
            cp = result.get('current_price')
            try:
                per_text = f'{float(cp):,.0f}원' if cp is not None and float(cp) > 0 else None
            except (TypeError, ValueError):
                per_text = None
            with conn.cursor() as c:
                c.execute(
                    """
                    INSERT INTO ai_analyses
                    (user_id, stock_id, target_type, target_key, rating, per_text, summary, created_at)
                    VALUES (%s, %s, 'STOCK', %s, %s, %s, %s, NOW())
                    """,
                    (user_id, stock_id, stock_name[:50], rating, per_text, summary),
                )
                new_id = c.lastrowid
            if new_id:
                print(f'[ai_analyses] 저장 완료 analysis_id={new_id} stock={stock_name!r}')
            if stock_id:
                try:
                    _bump_stock_popularity_on_analysis(conn, stock_id)
                except Exception as bump_err:
                    bc = getattr(bump_err, 'args', None)
                    if not (bc and bc[0] == 1146):
                        print(f'[stock_popularity] 갱신 실패: {bump_err}')
            conn.commit()
        except Exception as e:
            conn.rollback()
            code = getattr(e, 'args', None)
            if code and code[0] == 1146:
                return
            print(f'[ai_analyses] 저장 실패: {e}')
        finally:
            conn.close()
    except Exception as e:
        print(f'[ai_analyses] DB 연결 실패: {e}')


# 종목 분석 API 엔드포인트
def serve_analyze():
    """종목 분석 API 엔드포인트"""
    data = request.get_json(silent=True) or {}
    stock_name = (data.get('stock_name') or '').strip()
        
    if not stock_name:
        return jsonify({'success': False, 'message': '종목명을 입력해주세요.'}), 400

    catalog_item = _resolve_catalog_item_for_input(stock_name)
    analysis_target = str((catalog_item or {}).get('name') or '').strip() or stock_name

    result = analyze_stock(analysis_target)
    if result.get('success') and catalog_item:
        result['stock_name'] = str(catalog_item.get('name') or analysis_target).strip() or analysis_target
        if not str(result.get('chart_code') or '').strip():
            result['chart_code'] = str(catalog_item.get('code') or '').strip()
    uid = session.get('user_id')
    if uid is not None:
        try:
            uid = int(uid)
        except (TypeError, ValueError):
            uid = None
    _persist_ai_analysis_row(result, analysis_target, uid)
    return jsonify(result)


# 용어 설명 API 엔드포인트
def serve_explain_term():
    """용어 설명 API 엔드포인트"""
    data = request.get_json(silent=True) or {}
    term = (data.get('term') or '').strip()

    if not term:
        return jsonify({'success': False, 'message': '설명할 용어를 입력해주세요.'}), 400

    gpt_result = explain_term_with_gpt(term)
    if not gpt_result.get('success'):
        status_code = gpt_result.get('status_code', 500)
        if status_code == 429:
            fallback_answer = explain_term_with_local_fallback(term)
            return jsonify({
                'success': True,
                'term': term,
                'answer': fallback_answer,
                'source': 'local-fallback',
                'notice': 'GPT 쿼터 초과로 로컬 요약 답변을 제공했습니다.'
            })
        return jsonify({
            'success': False,
            'message': gpt_result.get('message', '용어 설명에 실패했습니다. 일시 후 다시 시도해주세요.')
        }), status_code

    return jsonify({
        'success': True,
        'term': term,
        'answer': _clean_gpt_prose(gpt_result.get('text', ''))
    })


def _score_price_stock_match(code, name, q_raw):
    """종목명·코드 부분 일치 점수(낮을수록 더 잘 맞음). 일치 없으면 None."""
    q = (q_raw or '').strip()
    if not q:
        return None
    code = str(code or '').strip()
    name = str(name or '')
    ql = q.lower()
    hay = name.lower()
    if code == q:
        return (0, 0)
    if hay == ql:
        return (0, 1)
    if q.isdigit() and code.startswith(q):
        return (1, len(code))
    if hay.startswith(ql):
        return (2, len(name))
    pos = hay.find(ql)
    if pos >= 0:
        return (3, pos, len(name))
    pos = code.find(q)
    if pos >= 0:
        return (4, pos)
    if q in name:
        return (5, name.find(q), len(name))
    return None


def _matched_codes_for_price_query(q_raw, max_codes=80):
    """국내 종목 카탈로그에서 검색어에 맞는 종목코드(관련도 순)."""
    q = (q_raw or '').strip()
    if not q:
        return []
    scored = []
    for item in _fetch_active_domestic_stock_catalog():
        code = str(item.get('code') or '').strip()
        name = _searchable_stock_name(item)
        sc = _score_price_stock_match(code, name, q)
        if sc is not None:
            scored.append((sc, code))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [c for _, c in scored[:max_codes]]


def _matched_stock_catalog_items(q_raw, max_items=80):
    """국내 종목 카탈로그에서 검색어에 맞는 종목 목록(관련도 순)."""
    q = (q_raw or '').strip()
    if not q:
        return []
    scored = []
    for item in _fetch_active_domestic_stock_catalog():
        code = str(item.get('code') or '').strip()
        name = _searchable_stock_name(item)
        sc = _score_price_stock_match(code, name, q)
        if sc is not None:
            scored.append((sc, code, _catalog_display_name(code, item.get('name'))))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [{'code': c, 'name': n} for _, c, n in scored[:max_items]]


def serve_stock_suggest():
    """종목 자동완성(stocks 카탈로그 기준)."""
    q = (request.args.get('q') or '').strip()
    try:
        limit = int(request.args.get('limit', '12'))
    except ValueError:
        limit = 12
    limit = max(1, min(100, limit))
    if not q:
        return jsonify({'success': True, 'items': []})
    items = _matched_stock_catalog_items(q, max_items=limit)
    return jsonify({'success': True, 'items': items})


# 모의투자용 종목 목록(거래대금 순).
def serve_mock_traded_value_rank():
    """모의투자용 종목 목록(거래대금 순)."""
    try:
        limit = int(request.args.get('limit', '100'))
    except ValueError:
        limit = 100
    limit = max(1, min(100, limit))

    search_q = (request.args.get('q') or '').strip()
    match_order = {}
    code_name_items = []
    if search_q:
        code_name_items = _matched_stock_catalog_items(search_q, max_items=max(limit, _WEB_PRICE_MAX_COUNT))
        codes = [str(it.get('code') or '').strip() for it in code_name_items if str(it.get('code') or '').strip()]
        if not codes:
            return jsonify({'success': True, 'items': []})
        for i, c in enumerate(codes):
            match_order[c] = i
    else:
        code_name_items = _get_live_price_universe_items()
        codes = [c for c, _ in code_name_items[:max(limit, _WEB_PRICE_MAX_COUNT)]]
    if not code_name_items:
        code_name_items = [(c, _catalog_display_name(c)) for c in codes]
    normalized_items = []
    seen_codes = set()
    for item in code_name_items:
        if isinstance(item, dict):
            code = str(item.get('code') or '').strip()
            name = _catalog_display_name(code, item.get('name'))
        else:
            code = str((item or ('', ''))[0] or '').strip()
            name = _catalog_display_name(code, (item or ('', ''))[1])
        if not code or code in seen_codes:
            continue
        seen_codes.add(code)
        normalized_items.append((code, name))
    snap = {}
    if fetch_live_snapshot_batch:
        try:
            snap = fetch_live_snapshot_batch(codes) or {}
        except Exception:
            snap = {}

    vol_map = {}
    open_map = {}
    prev_close_map = {}
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if len(codes) == 0:
                pass
            else:
                ph = ','.join(['%s'] * len(codes))
                cur.execute(
                    f"""
                    SELECT s.symbol, COALESCE(sp.volume, 0) AS v,
                           COALESCE(sp.open_price, 0) AS o
                    FROM stocks s
                    JOIN stock_price_daily sp ON sp.stock_id = s.stock_id
                    WHERE s.symbol IN ({ph})
                      AND sp.date = (
                        SELECT MAX(sp2.date) FROM stock_price_daily sp2 WHERE sp2.stock_id = s.stock_id
                      )
                    """,
                    tuple(codes),
                )
                for row in cur.fetchall() or []:
                    sym = str(row.get('symbol') or '').strip()
                    if sym:
                        vol_map[sym] = int(float(row.get('v') or 0))
                        try:
                            opx = int(float(row.get('o') or 0))
                        except (TypeError, ValueError):
                            opx = 0
                        if opx > 0:
                            open_map[sym] = opx
                cur.execute(
                    f"""
                    SELECT s.symbol, sp.close_price
                    FROM stocks s
                    JOIN stock_price_daily sp ON sp.stock_id = s.stock_id
                    WHERE s.symbol IN ({ph})
                      AND sp.date = (
                        SELECT MAX(sp2.date)
                        FROM stock_price_daily sp2
                        WHERE sp2.stock_id = s.stock_id
                          AND sp2.date < (
                            SELECT MAX(sp3.date)
                            FROM stock_price_daily sp3
                            WHERE sp3.stock_id = s.stock_id
                          )
                      )
                    """,
                    tuple(codes),
                )
                for row in cur.fetchall() or []:
                    sym = str(row.get('symbol') or '').strip()
                    if not sym:
                        continue
                    try:
                        prev_close_map[sym] = int(float(row.get('close_price') or 0))
                    except (TypeError, ValueError):
                        pass
    except Exception as e:
        print(f'[mock/traded-value-rank] volume 조회: {e}')
    finally:
        if conn:
            conn.close()

    items = []
    for code, name in normalized_items:
        row = snap.get(code) or {}
        price, rate, direction = _effective_quote_for_mock(code, row)
        if abs(rate) < 1e-9 and price > 0:
            prev_c = prev_close_map.get(code)
            if prev_c and prev_c > 0:
                rate = round((price - prev_c) / prev_c * 100, 2)
                if rate > 1e-9:
                    direction = 'up'
                elif rate < -1e-9:
                    direction = 'down'
                else:
                    direction = 'flat'
        if price <= 0:
            continue
        vol = vol_map.get(code, 0)
        if vol <= 0:
            vol = max(1, price // 500)
        traded_value = float(price) * float(vol)
        open_px = _opening_price_for_mock(code, open_map.get(code, 0))
        items.append({
            'code': code,
            'name': name,
            'price': price,
            'open_price': open_px,
            'change_rate': round(rate, 2),
            'direction': direction,
            'volume': vol,
            'traded_value': int(traded_value),
            '_mi': match_order.get(code, 99) if match_order else 0,
        })

    if match_order:
        items.sort(key=lambda x: (x.get('_mi', 99), -x['traded_value']))
    else:
        items.sort(key=lambda x: -x['traded_value'])
    for it in items:
        it.pop('_mi', None)
    try:
        token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None
        nudge = normalized_items[: min(_WEB_REFRESH_BATCH_SIZE, len(normalized_items))]
        if nudge:
            _start_live_refresh(nudge, token, force=False)
    except Exception:
        pass

    return jsonify({'success': True, 'items': items[:limit]})


# 모의투자 종목 상세 시세 탭용(고저·체결강도·52주·전일 거래량 비·거래대금 순위 등, 표시용 모의값 포함).
def serve_mock_sim_holding_quote_detail(code):
    code = str(code or '').strip()
    if not re.match(r'^\d{6}$', code):
        return jsonify({'success': False, 'message': '종목코드는 6자리 숫자여야 합니다.'}), 400

    code_name_items = _get_live_price_universe_items()
    normalized_items = []
    seen_codes = set()
    for item in code_name_items:
        if isinstance(item, dict):
            c = str(item.get('code') or '').strip()
            name = _catalog_display_name(c, item.get('name'))
        else:
            c = str((item or ('', ''))[0] or '').strip()
            name = _catalog_display_name(c, (item or ('', ''))[1])
        if not c or c in seen_codes:
            continue
        seen_codes.add(c)
        normalized_items.append((c, name))
    if code not in seen_codes:
        normalized_items.append((code, _catalog_display_name(code, None)))
        seen_codes.add(code)

    codes = [c for c, _ in normalized_items]
    snap = {}
    if fetch_live_snapshot_batch:
        try:
            snap = fetch_live_snapshot_batch(codes) or {}
        except Exception:
            snap = {}

    vol_map = {}
    open_map = {}
    prev_close_map = {}
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            if len(codes) > 0:
                ph = ','.join(['%s'] * len(codes))
                cur.execute(
                    f"""
                    SELECT s.symbol, COALESCE(sp.volume, 0) AS v,
                           COALESCE(sp.open_price, 0) AS o
                    FROM stocks s
                    JOIN stock_price_daily sp ON sp.stock_id = s.stock_id
                    WHERE s.symbol IN ({ph})
                      AND sp.date = (
                        SELECT MAX(sp2.date) FROM stock_price_daily sp2 WHERE sp2.stock_id = s.stock_id
                      )
                    """,
                    tuple(codes),
                )
                for row in cur.fetchall() or []:
                    sym = str(row.get('symbol') or '').strip()
                    if sym:
                        vol_map[sym] = int(float(row.get('v') or 0))
                        try:
                            opx = int(float(row.get('o') or 0))
                        except (TypeError, ValueError):
                            opx = 0
                        if opx > 0:
                            open_map[sym] = opx
                cur.execute(
                    f"""
                    SELECT s.symbol, sp.close_price
                    FROM stocks s
                    JOIN stock_price_daily sp ON sp.stock_id = s.stock_id
                    WHERE s.symbol IN ({ph})
                      AND sp.date = (
                        SELECT MAX(sp2.date)
                        FROM stock_price_daily sp2
                        WHERE sp2.stock_id = s.stock_id
                          AND sp2.date < (
                            SELECT MAX(sp3.date)
                            FROM stock_price_daily sp3
                            WHERE sp3.stock_id = s.stock_id
                          )
                      )
                    """,
                    tuple(codes),
                )
                for row in cur.fetchall() or []:
                    sym = str(row.get('symbol') or '').strip()
                    if not sym:
                        continue
                    try:
                        prev_close_map[sym] = int(float(row.get('close_price') or 0))
                    except (TypeError, ValueError):
                        pass
    except Exception as e:
        print(f'[mock/sim-holding-quote-detail] volume 조회: {e}')
    finally:
        if conn:
            conn.close()

    items = []
    name_for_code = dict(normalized_items)
    for c_i, name in normalized_items:
        row = snap.get(c_i) or {}
        price, rate, direction = _effective_quote_for_mock(c_i, row)
        if abs(rate) < 1e-9 and price > 0:
            prev_c = prev_close_map.get(c_i)
            if prev_c and prev_c > 0:
                rate = round((price - prev_c) / prev_c * 100, 2)
                if rate > 1e-9:
                    direction = 'up'
                elif rate < -1e-9:
                    direction = 'down'
                else:
                    direction = 'flat'
        if price <= 0:
            continue
        vol = vol_map.get(c_i, 0)
        if vol <= 0:
            vol = max(1, price // 500)
        traded_value = float(price) * float(vol)
        open_px = _opening_price_for_mock(c_i, open_map.get(c_i, 0))
        items.append({
            'code': c_i,
            'name': name,
            'price': price,
            'open_price': open_px,
            'change_rate': round(rate, 2),
            'direction': direction,
            'volume': vol,
            'traded_value': int(traded_value),
        })

    items.sort(key=lambda x: -x['traded_value'])
    total_ranked = len(items)
    match = next((x for x in items if x['code'] == code), None)
    traded_value_rank = None
    if match is not None:
        for idx, it in enumerate(items):
            if it['code'] == code:
                traded_value_rank = idx + 1
                break

    if match is None:
        nm = name_for_code.get(code, _catalog_display_name(code, None))
        row0 = snap.get(code) or {}
        price0, rate0, direction0 = _effective_quote_for_mock(code, row0)
        vol0 = vol_map.get(code, 0)
        if vol0 <= 0 and price0 > 0:
            vol0 = max(1, price0 // 500)
        tv0 = int(float(price0) * float(vol0)) if price0 > 0 else 0
        match = {
            'code': code,
            'name': nm,
            'price': price0,
            'open_price': _opening_price_for_mock(code, open_map.get(code, 0)),
            'change_rate': round(rate0, 2),
            'direction': direction0,
            'volume': vol0,
            'traded_value': tv0,
        }

    price = int(match['price'])
    volume = int(match['volume'])
    traded_value = int(match['traded_value'])
    open_price = int(match.get('open_price') or 0)
    snap_row = snap.get(code) or {}

    day_high = int(snap_row.get('high') or 0)
    day_low = int(snap_row.get('low') or 0)
    if day_high <= 0:
        day_high = price
    if day_low <= 0:
        day_low = price

    stock_id = _chart_resolve_stock_id(code)
    prev_volume = None
    week52_high = None
    week52_low = None
    latest_high = None
    latest_low = None
    latest_open = None
    if stock_id:
        conn2 = None
        try:
            conn2 = get_db_connection()
            with conn2.cursor() as cur:
                cur.execute(
                    """
                    SELECT open_price, high_price, low_price, close_price, volume
                    FROM stock_price_daily
                    WHERE stock_id = %s
                    ORDER BY date DESC
                    LIMIT 2
                    """,
                    (stock_id,),
                )
                rows2 = cur.fetchall() or []
                if len(rows2) >= 1:
                    r0 = rows2[0]
                    try:
                        latest_open = int(round(float(r0.get('open_price') or 0)))
                    except (TypeError, ValueError):
                        latest_open = 0
                    try:
                        latest_high = int(round(float(r0.get('high_price') or 0)))
                    except (TypeError, ValueError):
                        latest_high = 0
                    try:
                        latest_low = int(round(float(r0.get('low_price') or 0)))
                    except (TypeError, ValueError):
                        latest_low = 0
                    if latest_high > 0:
                        day_high = max(day_high, latest_high)
                    if latest_low > 0:
                        day_low = min(day_low, latest_low) if day_low > 0 else latest_low
                    if latest_open > 0 and open_price <= 0:
                        open_price = latest_open
                if len(rows2) >= 2:
                    try:
                        prev_volume = int(float(rows2[1].get('volume') or 0))
                    except (TypeError, ValueError):
                        prev_volume = None

                cur.execute(
                    """
                    SELECT MAX(sp.high_price) AS h52, MIN(sp.low_price) AS l52
                    FROM stock_price_daily sp
                    WHERE sp.stock_id = %s
                      AND sp.date >= (
                        SELECT DATE_SUB(MAX(sp2.date), INTERVAL 400 DAY)
                        FROM stock_price_daily sp2
                        WHERE sp2.stock_id = %s
                      )
                    """,
                    (stock_id, stock_id),
                )
                wrow = cur.fetchone() or {}
                try:
                    h52 = wrow.get('h52')
                    if h52 is not None:
                        week52_high = int(round(float(h52)))
                except (TypeError, ValueError):
                    week52_high = None
                try:
                    l52 = wrow.get('l52')
                    if l52 is not None:
                        week52_low = int(round(float(l52)))
                except (TypeError, ValueError):
                    week52_low = None
        except Exception as e2:
            print(f'[mock/sim-holding-quote-detail] 일봉/52주: {e2}')
        finally:
            if conn2:
                conn2.close()

    if day_high < day_low:
        day_high, day_low = day_low, day_high
    if day_high < price:
        day_high = price
    if day_low > price:
        day_low = price

    volume_vs_prev_ratio = None
    if prev_volume is not None and prev_volume > 0 and volume >= 0:
        volume_vs_prev_ratio = round(float(volume) / float(prev_volume), 4)

    price_in_52w_ratio = None
    if (
        week52_high is not None
        and week52_low is not None
        and week52_high > week52_low
        and price > 0
    ):
        price_in_52w_ratio = _clamp(
            (float(price) - float(week52_low)) / (float(week52_high) - float(week52_low)),
            0.0,
            1.0,
        )

    exec_strength_pct, exec_strength_side, exec_strength_caption = _mock_exec_strength_metrics(
        code,
        volume=volume,
        change_rate=match.get('change_rate'),
        direction=match.get('direction'),
    )

    try:
        token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None
        nudge = [(code, match.get('name') or code)]
        _start_live_refresh(nudge, token, force=False)
    except Exception:
        pass

    payload = {
        'success': True,
        'code': code,
        'name': match.get('name') or name_for_code.get(code, code),
        'price': price,
        'open_price': open_price,
        'day_high': day_high,
        'day_low': day_low,
        'volume': volume,
        'traded_value': traded_value,
        'change_rate': match.get('change_rate'),
        'direction': match.get('direction'),
        'prev_volume': prev_volume,
        'volume_vs_prev_ratio': volume_vs_prev_ratio,
        'week52_high': week52_high,
        'week52_low': week52_low,
        'price_in_52w_ratio': price_in_52w_ratio,
        'traded_value_rank': traded_value_rank,
        'traded_value_rank_total': total_ranked,
        'exec_strength_pct': exec_strength_pct,
        'exec_strength_side': exec_strength_side,
        'exec_strength_caption': exec_strength_caption,
        'disclaimer': (
            '체결강도는 (매수 체결량÷매도 체결량)×100%로 표시합니다. '
            '현재는 거래소 실시간 체결 구분이 없어 당일 시세·거래량 기준 모의 추정값이며, '
            '증권사 HTS 지표와 다를 수 있습니다.'
        ),
    }
    return jsonify(payload)


# 모의투자 종목 상세「AI 의견」탭용 짧은 종목 코멘트(경량 GPT 1회).
def serve_mock_sim_options_ai_brief():
    data = request.get_json(silent=True) or {}
    code = str(data.get('code') or '').strip()
    if not re.match(r'^\d{6}$', code):
        return jsonify({'success': False, 'message': '종목코드는 6자리 숫자여야 합니다.'}), 400

    raw_name = str(data.get('name') or '').strip()
    display_name = _catalog_display_name(code, raw_name)

    prompt = (
        '당신은 한국 상장사 종목을 다루는 시장 교육용 도우미입니다.\n'
        f'[종목] 코드 {code}, 표시명: {display_name}\n'
        '[과제] 위 종목에 대해 공개적으로 알려진 정보·섹터·사업 특성을 바탕으로, '
        '투자자가 참고할 수 있는 **짧은 종목 관점 요약**을 한국어로 **딱 2~3문장**만 작성하세요.\n'
        '- 업종·사업 모델·실적/성장·리스크 요인 등 일반적 관점에서 서술합니다.\n'
        '- 구체적 매수·매도 지시, 목표가, 수익 보장, 특정 증권사·상품 권유는 금지합니다.\n'
        '- 옵션·ELW 등 파생상품 설명에 초점을 두지 마세요. 해당 종목 자체에 대해서만 씁니다.\n'
        '- 반드시 JSON 객체 하나만 출력합니다(앞뒤 설명·마크다운 금지).\n'
        '- 스키마: {"brief":"본문"}\n'
        '- brief는 공백 포함 380자 이내입니다.'
    )
    gpt_result = call_gpt(prompt, model=DEFAULT_GPT_MODEL)
    if not gpt_result.get('success'):
        status = int(gpt_result.get('status_code') or 503)
        if status not in (400, 401, 403, 429, 502, 503):
            status = 503
        return jsonify({
            'success': False,
            'message': gpt_result.get('message') or 'AI 의견을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.',
        }), status

    raw_text = str(gpt_result.get('text') or '')
    obj = _extract_first_json_object(raw_text) or {}
    brief = str(obj.get('brief') or '').strip()
    if brief:
        brief = _clean_gpt_prose(brief).strip()
    else:
        brief = _clean_gpt_prose(raw_text).strip()
    if len(brief) > 400:
        brief = brief[:400].rstrip()

    if not brief:
        return jsonify({
            'success': False,
            'message': 'AI 응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.',
        }), 502

    return jsonify({
        'success': True,
        'code': code,
        'name': display_name,
        'text': brief,
    })


# 국내주식 호가·예상체결 (한국투자 domestic-stock v1 quotations inquire-asking-price-exp-ccn).
def serve_mock_asking_price(code):
    """국내주식 호가·예상체결 (한국투자 domestic-stock v1 quotations inquire-asking-price-exp-ccn)."""
    code = str(code or '').strip()
    if not re.match(r'^\d{6}$', code):
        return jsonify({'success': False, 'message': '종목코드는 6자리 숫자여야 합니다.'}), 400
    if not _KIS_KEY or not _KIS_SECRET:
        return jsonify({
            'success': False,
            'message': 'KIS_APP_KEY / KIS_APP_SECRET 이 없어 호가를 조회할 수 없습니다.',
        }), 503
    now = time.time()
    with _ASKING_PRICE_CACHE_LOCK:
        hit = _ASKING_PRICE_CACHE.get(code)
        if hit and (now - hit[0]) < _ASKING_PRICE_CACHE_TTL:
            return jsonify({'success': True, 'code': code, **hit[1]})
    token = _kis_get_token()
    if not token:
        return jsonify({'success': False, 'message': '한국투자 인증 토큰을 받지 못했습니다.'}), 503
    # 동시에 여러 호가 요청이 몰리면 KIS TPS 초과 → 실제 KIS 호출은 전역 1개씩만
    with _ASKING_FETCH_SERIAL_LOCK:
        now2 = time.time()
        with _ASKING_PRICE_CACHE_LOCK:
            hit = _ASKING_PRICE_CACHE.get(code)
            if hit and (now2 - hit[0]) < _ASKING_PRICE_CACHE_TTL:
                return jsonify({'success': True, 'code': code, **hit[1]})
        ob, err = _kis_fetch_asking_price_exp_ccn(token, code)
        if ob:
            with _ASKING_PRICE_CACHE_LOCK:
                _ASKING_PRICE_CACHE[code] = (time.time(), {**ob})
            return jsonify({'success': True, 'code': code, **ob})
        after = time.time()
        with _ASKING_PRICE_CACHE_LOCK:
            hit = _ASKING_PRICE_CACHE.get(code)
            if hit and (after - hit[0]) <= _ASKING_STALE_FALLBACK_SEC:
                return jsonify({'success': True, 'code': code, **hit[1], 'quote_stale': True})
    return jsonify({'success': False, 'message': err or '호가 조회에 실패했습니다.'}), 502


# 로그인 사용자의 모의투자 자산/보유/주문 내역 조회
def serve_mock_portfolio():
    """로그인 사용자의 모의투자 자산/보유/주문 내역 조회"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT account_id, initial_cash, cash_balance, created_at, updated_at
                FROM virtual_accounts
                WHERE user_id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            account = cursor.fetchone()
            if not account:
                account = _ensure_mock_account(cursor, user_id)
                conn.commit()
            if not account:
                return jsonify({'success': False, 'message': '가상계좌를 준비할 수 없습니다.'}), 500

            account_id = account['account_id']

            cursor.execute(
                """
                SELECT
                    vp.position_id,
                    s.stock_id,
                    s.symbol,
                    s.name_ko,
                    vp.quantity,
                    vp.avg_price,
                    COALESCE(s.current_price, sp.close_price, vp.avg_price) AS current_price,
                    vp.updated_at
                FROM virtual_positions vp
                JOIN stocks s ON s.stock_id = vp.stock_id
                LEFT JOIN stock_price_daily sp
                    ON sp.stock_id = vp.stock_id
                    AND sp.date = (
                        SELECT MAX(sp2.date)
                        FROM stock_price_daily sp2
                        WHERE sp2.stock_id = vp.stock_id
                    )
                WHERE vp.account_id = %s
                ORDER BY s.name_ko ASC
                """,
                (account_id,),
            )
            holdings = cursor.fetchall() or []

            try:
                cursor.execute(
                    """
                    SELECT
                        vo.order_id,
                        vo.side,
                        vo.price,
                        vo.quantity,
                        vo.status,
                        vo.fee_amount,
                        COALESCE(vo.tax_amount, 0) AS tax_amount,
                        vo.executed_at,
                        vo.created_at,
                        s.symbol,
                        s.name_ko
                    FROM virtual_orders vo
                    JOIN stocks s ON s.stock_id = vo.stock_id
                    WHERE vo.account_id = %s
                    ORDER BY vo.created_at DESC
                    LIMIT 100
                    """,
                    (account_id,),
                )
            except Exception as ord_err:
                es = str(ord_err).lower()
                if 'tax_amount' in es or 'unknown column' in es:
                    cursor.execute(
                        """
                        SELECT
                            vo.order_id,
                            vo.side,
                            vo.price,
                            vo.quantity,
                            vo.status,
                            vo.fee_amount,
                            vo.executed_at,
                            vo.created_at,
                            s.symbol,
                            s.name_ko
                        FROM virtual_orders vo
                        JOIN stocks s ON s.stock_id = vo.stock_id
                        WHERE vo.account_id = %s
                        ORDER BY vo.created_at DESC
                        LIMIT 100
                        """,
                        (account_id,),
                    )
                else:
                    raise
            orders = cursor.fetchall() or []

        cash_balance = _won_int(account.get('cash_balance'))
        initial_cash = _won_int(account.get('initial_cash'))
        holding_asset = 0
        unrealized_profit = 0
        normalized_holdings = []
        for row in holdings:
            qty = int(row.get('quantity') or 0)
            avg_price = _won_int(row.get('avg_price'))
            current_price = _won_int(row.get('current_price'))
            code_sym = str(row.get('symbol') or '').strip()
            eff_p, _, __ = _effective_quote_for_mock(
                code_sym, {'price': current_price, 'rate': 0, 'direction': 'flat'}
            )
            if eff_p > 0:
                current_price = eff_p
            eval_amount = qty * current_price
            profit = (current_price - avg_price) * qty
            rate = (profit / (avg_price * qty) * 100) if qty > 0 and avg_price > 0 else 0.0
            holding_asset += eval_amount
            unrealized_profit += profit
            normalized_holdings.append({
                'stock_id': row.get('stock_id'),
                'code': row.get('symbol'),
                'name': row.get('name_ko') or row.get('symbol'),
                'quantity': qty,
                'avg_price': avg_price,
                'current_price': current_price,
                'eval_amount': eval_amount,
                'profit': profit,
                'profit_rate': round(rate, 2),
                'updated_at': row.get('updated_at'),
            })

        total_asset = cash_balance + holding_asset
        total_profit = total_asset - initial_cash
        total_return = (total_profit / initial_cash * 100) if initial_cash > 0 else 0.0

        normalized_orders = []
        for row in orders:
            qty = int(row.get('quantity') or 0)
            price = _won_int(row.get('price'))
            gross = price * qty
            fee_amt = _won_int(row.get('fee_amount'))
            tax_amt = _won_int(row.get('tax_amount'))
            normalized_orders.append({
                'order_id': row.get('order_id'),
                'side': row.get('side'),
                'price': price,
                'quantity': qty,
                'total': gross,
                'fee': fee_amt,
                'tax': tax_amt,
                'status': row.get('status'),
                'executed_at': row.get('executed_at'),
                'created_at': row.get('created_at'),
                'code': row.get('symbol'),
                'name': row.get('name_ko') or row.get('symbol'),
            })

        return jsonify({
            'success': True,
            'account': {
                'account_id': account_id,
                'initial_cash': initial_cash,
                'cash_balance': cash_balance,
                'created_at': account.get('created_at'),
                'updated_at': account.get('updated_at'),
            },
            'summary': {
                'total_asset': total_asset,
                'cash_balance': cash_balance,
                'holding_asset': holding_asset,
                'total_profit': total_profit,
                'total_return': round(total_return, 2),
                'holding_count': len(normalized_holdings),
                'unrealized_profit': unrealized_profit,
            },
            'holdings': normalized_holdings,
            'orders': normalized_orders,
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'포트폴리오 조회 실패: {e}'}), 500
    finally:
        if conn:
            conn.close()


def _mock_ranking_display_name(row):
    """랭킹 표시용 닉네임 (개인정보 최소 노출)."""
    nick = str((row or {}).get('nickname') or '').strip()
    if nick:
        return nick[:24]
    email = str((row or {}).get('email') or '').strip()
    if email and '@' in email:
        local = email.split('@', 1)[0]
        if len(local) >= 2:
            return local[:2] + '***'
        return local or '주린이'
    return '주린이'


def _mock_account_holding_asset(cursor, account_id):
    """가상계좌 보유 평가금 합계(원)."""
    cursor.execute(
        """
        SELECT
            vp.quantity,
            vp.avg_price,
            COALESCE(s.current_price, sp.close_price, vp.avg_price) AS current_price,
            s.symbol
        FROM virtual_positions vp
        JOIN stocks s ON s.stock_id = vp.stock_id
        LEFT JOIN stock_price_daily sp
            ON sp.stock_id = vp.stock_id
            AND sp.date = (
                SELECT MAX(sp2.date)
                FROM stock_price_daily sp2
                WHERE sp2.stock_id = vp.stock_id
            )
        WHERE vp.account_id = %s
        """,
        (account_id,),
    )
    rows = cursor.fetchall() or []
    holding_asset = 0
    for row in rows:
        qty = int(row.get('quantity') or 0)
        if qty <= 0:
            continue
        current_price = _won_int(row.get('current_price'))
        code_sym = str(row.get('symbol') or '').strip()
        eff_p, _, __ = _effective_quote_for_mock(
            code_sym, {'price': current_price, 'rate': 0, 'direction': 'flat'}
        )
        if eff_p > 0:
            current_price = eff_p
        holding_asset += qty * current_price
    return holding_asset


def serve_mock_monthly_ranking():
    """
    이달 모의투자 랭킹 (활동 계좌 · 현재 총 수익률 기준, 상위 30명).
    로그인 없이 조회 가능. 로그인 시 my_rank 포함.
    """
    viewer_user_id = session.get('user_id')
    now = datetime.now()
    month_start = datetime(now.year, now.month, 1)
    period_label = f'{now.year}년 {now.month}월'

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    va.account_id,
                    va.user_id,
                    va.initial_cash,
                    va.cash_balance,
                    u.nickname,
                    u.email
                FROM virtual_accounts va
                INNER JOIN users u ON u.user_id = va.user_id
                WHERE EXISTS (
                    SELECT 1
                    FROM virtual_orders vo
                    WHERE vo.account_id = va.account_id
                      AND COALESCE(vo.executed_at, vo.created_at) >= %s
                )
                   OR va.updated_at >= %s
                """,
                (month_start, month_start),
            )
            accounts = cursor.fetchall() or []

        ranked = []
        with conn.cursor() as cursor:
            for acc in accounts:
                account_id = acc.get('account_id')
                initial_cash = _won_int(acc.get('initial_cash'))
                cash_balance = _won_int(acc.get('cash_balance'))
                holding_asset = _mock_account_holding_asset(cursor, account_id)
                total_asset = cash_balance + holding_asset
                total_profit = total_asset - initial_cash
                return_rate = (
                    (total_profit / initial_cash * 100) if initial_cash > 0 else 0.0
                )
                ranked.append({
                    'user_id': acc.get('user_id'),
                    'nickname': _mock_ranking_display_name(acc),
                    'return_rate': round(return_rate, 2),
                    'total_asset': total_asset,
                })

        ranked.sort(key=lambda x: (-x['return_rate'], -x['total_asset'], x['nickname']))
        my_rank = None
        if viewer_user_id:
            for idx, row in enumerate(ranked, start=1):
                if row.get('user_id') == viewer_user_id:
                    my_rank = idx
                    break

        items = []
        for idx, row in enumerate(ranked[:30], start=1):
            items.append({
                'rank': idx,
                'nickname': row['nickname'],
                'return_rate': row['return_rate'],
                'is_me': bool(viewer_user_id and row.get('user_id') == viewer_user_id),
            })

        return jsonify({
            'success': True,
            'period_label': period_label,
            'note': '이번 달 모의투자 활동이 있는 계좌를 현재 총 수익률 순으로 정렬했습니다.',
            'my_rank': my_rank,
            'total_participants': len(ranked),
            'items': items,
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'랭킹 조회 실패: {e}'}), 500
    finally:
        if conn:
            conn.close()


def _mock_order_dt(row):
    """주문 행에서 체결 시각(datetime) 추출."""
    for key in ('executed_at', 'created_at'):
        val = row.get(key)
        if val is None:
            continue
        if isinstance(val, datetime):
            return val
        if isinstance(val, date):
            return datetime.combine(val, datetime.min.time())
        try:
            return datetime.fromisoformat(str(val).replace('Z', '+00:00')[:26])
        except Exception:
            pass
    return datetime.now()


def _mock_fifo_realized_events(orders):
    """
    시간순 주문 목록 → 매도별 실현손익 이벤트.
    반환: [{ order_id, stock_id, code, name, quantity, sell_price, cost_basis, realized, fee, tax, executed_at }, ...]
    """
    sorted_orders = sorted(orders, key=_mock_order_dt)
    lots_by_stock = {}
    events = []

    for row in sorted_orders:
        side = str(row.get('side') or '').upper()
        if side not in ('BUY', 'SELL'):
            continue
        status = str(row.get('status') or 'EXECUTED').upper()
        if status not in ('EXECUTED', 'FILLED', 'COMPLETE', 'COMPLETED'):
            continue

        stock_id = row.get('stock_id')
        qty = int(row.get('quantity') or 0)
        if qty <= 0:
            continue
        price = _won_int(row.get('price'))
        fee = _won_int(row.get('fee_amount'))
        tax = _won_int(row.get('tax_amount'))
        code = row.get('symbol') or row.get('code') or ''
        name = row.get('name_ko') or row.get('name') or code
        executed_at = _mock_order_dt(row)

        if stock_id not in lots_by_stock:
            lots_by_stock[stock_id] = []

        if side == 'BUY':
            gross = price * qty
            unit_cost = int(round((gross + fee) / qty)) if qty > 0 else 0
            lots_by_stock[stock_id].append({'qty': qty, 'unit_cost': unit_cost})
            continue

        lots = lots_by_stock.get(stock_id) or []
        remain = qty
        cost_basis = 0
        while remain > 0 and lots:
            lot = lots[0]
            take = min(remain, lot['qty'])
            cost_basis += take * lot['unit_cost']
            lot['qty'] -= take
            remain -= take
            if lot['qty'] <= 0:
                lots.pop(0)
        lots_by_stock[stock_id] = lots

        gross_sell = price * qty
        proceeds = gross_sell - fee - tax
        realized = proceeds - cost_basis
        events.append({
            'order_id': row.get('order_id'),
            'stock_id': stock_id,
            'code': code,
            'name': name,
            'quantity': qty,
            'sell_price': price,
            'gross': gross_sell,
            'cost_basis': cost_basis,
            'realized': realized,
            'fee': fee,
            'tax': tax,
            'executed_at': executed_at,
        })

    return events


def _parse_pnl_anchor(anchor_str):
    """YYYY-MM-DD anchor → date."""
    if not anchor_str:
        return date.today()
    try:
        return datetime.strptime(str(anchor_str)[:10], '%Y-%m-%d').date()
    except Exception:
        return date.today()


def _pnl_period_bounds(granularity, anchor_d):
    """(start_dt, end_dt, label, prev_anchor, next_anchor) — end exclusive."""
    gran = (granularity or 'day').lower()
    if gran == 'all':
        start = datetime(1970, 1, 1)
        end = datetime(2099, 12, 31, 23, 59, 59)
        return start, end, '전체 실현수익', None, None

    if gran == 'day':
        start = datetime.combine(anchor_d, datetime.min.time())
        end = start + timedelta(days=1)
        label = f'{anchor_d.month}월 {anchor_d.day}일 실현수익'
        prev_a = (anchor_d - timedelta(days=1)).isoformat()
        next_a = (anchor_d + timedelta(days=1)).isoformat()
        if anchor_d >= date.today():
            next_a = None
        return start, end, label, prev_a, next_a

    if gran == 'week':
        # 월요일 시작 주
        wd = anchor_d.weekday()
        week_start = anchor_d - timedelta(days=wd)
        start = datetime.combine(week_start, datetime.min.time())
        end = start + timedelta(days=7)
        week_end = week_start + timedelta(days=6)
        label = f'{week_start.month}/{week_start.day}~{week_end.month}/{week_end.day} 실현수익'
        prev_a = (week_start - timedelta(days=7)).isoformat()
        next_a = (week_start + timedelta(days=7)).isoformat()
        if week_start + timedelta(days=7) > date.today():
            next_a = None
        return start, end, label, prev_a, next_a

    if gran == 'month':
        start = datetime(anchor_d.year, anchor_d.month, 1)
        if anchor_d.month == 12:
            end = datetime(anchor_d.year + 1, 1, 1)
        else:
            end = datetime(anchor_d.year, anchor_d.month + 1, 1)
        label = f'{anchor_d.year}년 {anchor_d.month}월 실현수익'
        if anchor_d.month == 1:
            prev_a = date(anchor_d.year - 1, 12, 1).isoformat()
        else:
            prev_a = date(anchor_d.year, anchor_d.month - 1, 1).isoformat()
        if anchor_d.month == 12:
            next_m = date(anchor_d.year + 1, 1, 1)
        else:
            next_m = date(anchor_d.year, anchor_d.month + 1, 1)
        next_a = next_m.isoformat() if next_m <= date.today() else None
        return start, end, label, prev_a, next_a

    if gran == 'year':
        start = datetime(anchor_d.year, 1, 1)
        end = datetime(anchor_d.year + 1, 1, 1)
        label = f'{anchor_d.year}년 실현수익'
        prev_a = date(anchor_d.year - 1, 1, 1).isoformat()
        next_a = date(anchor_d.year + 1, 1, 1).isoformat() if anchor_d.year + 1 <= date.today().year else None
        return start, end, label, prev_a, next_a

    start = datetime.combine(anchor_d, datetime.min.time())
    end = start + timedelta(days=1)
    return start, end, f'{anchor_d.month}월 {anchor_d.day}일 실현수익', None, None


def serve_mock_realized_pnl():
    """기간별 실현손익(FIFO 매도 기준)."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    granularity = (request.args.get('granularity') or 'day').strip().lower()
    if granularity not in ('day', 'week', 'month', 'year', 'all'):
        granularity = 'day'
    anchor_d = _parse_pnl_anchor(request.args.get('anchor'))

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT account_id FROM virtual_accounts WHERE user_id = %s LIMIT 1
                """,
                (user_id,),
            )
            account = cursor.fetchone()
            if not account:
                account = _ensure_mock_account(cursor, user_id)
                conn.commit()
            if not account:
                return jsonify({'success': False, 'message': '가상계좌를 준비할 수 없습니다.'}), 500

            account_id = account['account_id']
            try:
                cursor.execute(
                    """
                    SELECT
                        vo.order_id,
                        vo.stock_id,
                        vo.side,
                        vo.price,
                        vo.quantity,
                        vo.status,
                        vo.fee_amount,
                        COALESCE(vo.tax_amount, 0) AS tax_amount,
                        vo.executed_at,
                        vo.created_at,
                        s.symbol,
                        s.name_ko
                    FROM virtual_orders vo
                    JOIN stocks s ON s.stock_id = vo.stock_id
                    WHERE vo.account_id = %s
                    ORDER BY COALESCE(vo.executed_at, vo.created_at) ASC, vo.order_id ASC
                    """,
                    (account_id,),
                )
            except Exception as ord_err:
                es = str(ord_err).lower()
                if 'tax_amount' in es or 'unknown column' in es:
                    cursor.execute(
                        """
                        SELECT
                            vo.order_id,
                            vo.stock_id,
                            vo.side,
                            vo.price,
                            vo.quantity,
                            vo.status,
                            vo.fee_amount,
                            vo.executed_at,
                            vo.created_at,
                            s.symbol,
                            s.name_ko
                        FROM virtual_orders vo
                        JOIN stocks s ON s.stock_id = vo.stock_id
                        WHERE vo.account_id = %s
                        ORDER BY COALESCE(vo.executed_at, vo.created_at) ASC, vo.order_id ASC
                        """,
                        (account_id,),
                    )
                else:
                    raise
            rows = cursor.fetchall() or []

        all_events = _mock_fifo_realized_events(rows)
        start_dt, end_dt, label, prev_anchor, next_anchor = _pnl_period_bounds(granularity, anchor_d)

        period_events = []
        for ev in all_events:
            dt = ev['executed_at']
            if isinstance(dt, date) and not isinstance(dt, datetime):
                dt = datetime.combine(dt, datetime.min.time())
            if start_dt <= dt < end_dt:
                period_events.append(ev)

        sales_total = sum(int(ev['realized']) for ev in period_events)
        breakdown = {
            'sales': sales_total,
            'dividend': 0,
            'lending': 0,
            'bond': 0,
            'interest': 0,
        }

        sales_trades = []
        for ev in reversed(period_events):
            dt = ev['executed_at']
            iso = dt.isoformat() if hasattr(dt, 'isoformat') else str(dt)
            sales_trades.append({
                'order_id': ev['order_id'],
                'code': ev['code'],
                'name': ev['name'],
                'quantity': ev['quantity'],
                'sell_price': ev['sell_price'],
                'cost_basis': ev['cost_basis'],
                'realized': ev['realized'],
                'fee': ev['fee'],
                'tax': ev['tax'],
                'executed_at': iso,
            })

        return jsonify({
            'success': True,
            'period': {
                'granularity': granularity,
                'label': label,
                'anchor': anchor_d.isoformat(),
                'start': start_dt.isoformat(),
                'end': end_dt.isoformat(),
                'prev_anchor': prev_anchor,
                'next_anchor': next_anchor,
            },
            'total_realized': sales_total,
            'breakdown': breakdown,
            'sales_trades': sales_trades,
            'note': '모의투자에서는 매도 체결 기준 판매수익만 집계합니다. 배당·이자 등은 0원으로 표시됩니다.',
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'실현수익 조회 실패: {e}'}), 500
    finally:
        if conn:
            conn.close()


def _watchlist_dt_json(val):
    if val is None:
        return None
    if hasattr(val, 'isoformat'):
        try:
            return val.isoformat(sep=' ', timespec='seconds')
        except TypeError:
            return val.isoformat()
    return str(val)


def serve_watchlist_list():
    """로그인 사용자의 관심 종목 목록 (종목코드·이름·추가 시각)."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT s.symbol, s.name_ko, uw.created_at
                FROM user_watchlist uw
                JOIN stocks s ON s.stock_id = uw.stock_id
                WHERE uw.user_id = %s
                ORDER BY uw.created_at DESC
                """,
                (user_id,),
            )
            rows = cursor.fetchall() or []

        items = []
        for r in rows:
            sym = str(r.get('symbol') or '').strip()
            if not sym:
                continue
            items.append({
                'code': sym,
                'name': str(r.get('name_ko') or sym),
                'created_at': _watchlist_dt_json(r.get('created_at')),
            })

        return jsonify({'success': True, 'items': items})
    except Exception as e:
        return jsonify({'success': False, 'message': f'관심 종목 조회 실패: {e}'}), 500
    finally:
        if conn:
            conn.close()


def serve_watchlist_toggle():
    """관심 종목 추가/제거 토글. body: { \"code\": \"005930\" }."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    body = request.get_json(silent=True) or {}
    code = (body.get('code') or body.get('stock') or '').strip()
    if not re.match(r'^\d{6}$', code):
        return jsonify({'success': False, 'message': '종목코드는 6자리 숫자여야 합니다.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            stock_row = _resolve_stock_for_trade(cursor, code)
            if not stock_row:
                return jsonify({'success': False, 'message': '등록되지 않은 종목입니다.'}), 400
            stock_id = int(stock_row['stock_id'])

            cursor.execute(
                'SELECT id FROM user_watchlist WHERE user_id = %s AND stock_id = %s LIMIT 1',
                (user_id, stock_id),
            )
            existing = cursor.fetchone()

            if existing:
                cursor.execute(
                    'DELETE FROM user_watchlist WHERE user_id = %s AND stock_id = %s',
                    (user_id, stock_id),
                )
                conn.commit()
                return jsonify({
                    'success': True,
                    'in_watchlist': False,
                    'message': '관심종목에서 제거했습니다.',
                })

            cursor.execute(
                """
                INSERT INTO user_watchlist (user_id, stock_id, created_at)
                VALUES (%s, %s, NOW())
                """,
                (user_id, stock_id),
            )
            conn.commit()

        return jsonify({
            'success': True,
            'in_watchlist': True,
            'message': '관심종목에 추가했습니다.',
        })
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return jsonify({'success': False, 'message': f'처리 실패: {e}'}), 500
    finally:
        if conn:
            conn.close()


# 잔고·가격을 원 단위 정수로 변환 (float 오차로 인한 1원 단위 누락 방지).
def _won_int(value):
    """잔고·가격을 원 단위 정수로 변환 (float 오차로 인한 1원 단위 누락 방지)."""
    if value is None:
        return 0
    if isinstance(value, Decimal):
        try:
            return int(value.to_integral_value(rounding=ROUND_HALF_UP))
        except Exception:
            return int(value)
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    try:
        return int(Decimal(str(value)).to_integral_value(rounding=ROUND_HALF_UP))
    except Exception:
        try:
            return int(float(value))
        except Exception:
            return 0


# 모의 매매: 단순 매매수수료·매도 증권거래세 (실제 증권사·세법과 다를 수 있음)
# 국내 현물 단순 모델: 매수에는 증권거래세 없음, 매도에만 약 0.18% 반영.
_MOCK_TRADE_COMMISSION_RATE = Decimal('0.00015')  # 약 0.015%/건
_MOCK_SECURITIES_TAX_RATE_SELL = Decimal('0.0018')  # 약 0.18% (매도, 단순 모델)


def _mock_trade_commission_and_tax(side, gross_won):
    """gross_won: 단가×수량(원). 반환 (수수료, 증권거래세) 원 int. 세금은 SELL일 때만."""
    g = max(0, _won_int(gross_won))
    if g <= 0:
        return 0, 0
    comm = int(
        (Decimal(g) * _MOCK_TRADE_COMMISSION_RATE).to_integral_value(rounding=ROUND_HALF_UP)
    )
    if comm < 1:
        comm = 1
    tax = 0
    if side == 'SELL':
        tax = int(
            (Decimal(g) * _MOCK_SECURITIES_TAX_RATE_SELL).to_integral_value(rounding=ROUND_HALF_UP)
        )
    return comm, tax


# `_ensure_mock_account` — 모듈 내부 헬퍼.
def _ensure_mock_account(cursor, user_id):
    cursor.execute(
        """
        SELECT account_id, initial_cash, cash_balance, created_at, updated_at
        FROM virtual_accounts
        WHERE user_id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    account = cursor.fetchone()
    if account:
        return account

    cursor.execute(
        """
        INSERT INTO virtual_accounts (user_id, initial_cash, cash_balance, created_at, updated_at)
        VALUES (%s, %s, %s, NOW(), NOW())
        """,
        (user_id, _MOCK_INITIAL_CASH, _MOCK_INITIAL_CASH),
    )
    cursor.execute(
        """
        SELECT account_id, initial_cash, cash_balance, created_at, updated_at
        FROM virtual_accounts
        WHERE user_id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    return cursor.fetchone()


# 종목 입력에서 6자리 코드 추출.
def _normalize_stock_trade_input(raw):
    """종목 입력에서 6자리 코드 추출."""
    s = (raw or '').strip()
    if not s:
        return s
    s = s.replace('\uff08', '(').replace('\uff09', ')')
    if ')' in s and '(' in s:
        try:
            i = s.rindex('(')
            j = s.rindex(')')
            if i < j:
                inner = re.sub(r'\D', '', s[i + 1 : j])
                if len(inner) == 6:
                    return inner
        except ValueError:
            pass
    return s


# `_resolve_stock_for_trade` — 모듈 내부 헬퍼.
def _resolve_stock_for_trade(cursor, stock_input):
    raw = _normalize_stock_trade_input((stock_input or '').strip())
    if not raw:
        return None

    cursor.execute(
        """
        SELECT stock_id, symbol, name_ko, current_price
        FROM stocks
        WHERE symbol = %s OR name_ko = %s
        LIMIT 1
        """,
        (raw, raw),
    )
    row = cursor.fetchone()
    if row:
        return row

    if raw in PRICE_STOCKS:
        cursor.execute(
            """
            INSERT INTO stocks (symbol, name_ko, created_at, updated_at)
            VALUES (%s, %s, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                name_ko = VALUES(name_ko),
                updated_at = NOW()
            """,
            (raw, PRICE_STOCKS.get(raw) or raw),
        )
        cursor.execute(
            """
            SELECT stock_id, symbol, name_ko, current_price
            FROM stocks
            WHERE symbol = %s
            LIMIT 1
            """,
            (raw,),
        )
        return cursor.fetchone()

    return None


# `serve_mock_trade` — 모듈 내부 헬퍼.
def serve_mock_trade():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401

    body = request.get_json(silent=True) or {}
    side = (body.get('side') or '').strip().upper()
    stock_input = (body.get('stock') or body.get('code') or '').strip()
    try:
        quantity = int(body.get('quantity') or 0)
    except (TypeError, ValueError):
        quantity = 0
    manual_price = _won_int(body.get('price'))

    if side not in {'BUY', 'SELL'}:
        return jsonify({'success': False, 'message': 'side는 BUY 또는 SELL이어야 합니다.'}), 400
    if not stock_input:
        return jsonify({'success': False, 'message': '종목 코드/이름을 입력해주세요.'}), 400
    if quantity <= 0:
        return jsonify({'success': False, 'message': '수량은 1 이상이어야 합니다.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            account = _ensure_mock_account(cursor, user_id)
            if not account:
                raise ValueError('가상계좌를 생성하지 못했습니다.')
            cursor.execute(
                """
                SELECT account_id, initial_cash, cash_balance
                FROM virtual_accounts
                WHERE user_id = %s
                FOR UPDATE
                """,
                (user_id,),
            )
            account = cursor.fetchone()
            if not account:
                raise ValueError('가상계좌를 조회하지 못했습니다.')

            stock = _resolve_stock_for_trade(cursor, stock_input)
            if not stock:
                return jsonify({'success': False, 'message': '등록되지 않은 종목입니다. 종목코드를 확인해주세요.'}), 404

            stock_id = int(stock['stock_id'])
            code = stock.get('symbol')
            name = stock.get('name_ko') or code
            account_id = int(account['account_id'])
            cash_balance = _won_int(account.get('cash_balance'))
            cash_before = cash_balance

            ref_price = _won_int(stock.get('current_price'))
            if ref_price <= 0:
                cursor.execute(
                    """
                    SELECT close_price
                    FROM stock_price_daily
                    WHERE stock_id = %s
                    ORDER BY date DESC
                    LIMIT 1
                    """,
                    (stock_id,),
                )
                latest_price = cursor.fetchone()
                ref_price = _won_int((latest_price or {}).get('close_price'))
            if ref_price <= 0:
                ref_price = manual_price
            if manual_price > 0:
                price = manual_price
            else:
                price = ref_price
            if price <= 0:
                return jsonify({'success': False, 'message': '체결가를 확인할 수 없습니다. 가격을 입력해주세요.'}), 400

            total_amount = price * quantity
            fee_c, tax_c = _mock_trade_commission_and_tax(side, total_amount)
            if side == 'BUY':
                cost_total = total_amount + fee_c
                if cash_balance < cost_total:
                    return jsonify({
                        'success': False,
                        'message': '잔액이 부족합니다. (거래금액+수수료를 포함합니다.)',
                    }), 400
                cursor.execute(
                    """
                    UPDATE virtual_accounts
                    SET cash_balance = cash_balance - %s, updated_at = NOW()
                    WHERE account_id = %s
                    """,
                    (cost_total, account_id),
                )
                cursor.execute(
                    """
                    INSERT INTO virtual_positions (account_id, stock_id, quantity, avg_price, updated_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                        avg_price = (avg_price * quantity + VALUES(avg_price) * VALUES(quantity))
                            / (quantity + VALUES(quantity)),
                        quantity = quantity + VALUES(quantity),
                        updated_at = NOW()
                    """,
                    (account_id, stock_id, quantity, price),
                )
            else:
                cursor.execute(
                    """
                    SELECT position_id, quantity
                    FROM virtual_positions
                    WHERE account_id = %s AND stock_id = %s
                    LIMIT 1
                    """,
                    (account_id, stock_id),
                )
                pos = cursor.fetchone()
                current_qty = int((pos or {}).get('quantity') or 0)
                if current_qty < quantity:
                    return jsonify({'success': False, 'message': '보유 수량이 부족합니다.'}), 400

                proceeds = total_amount - fee_c - tax_c
                if proceeds < 0:
                    proceeds = 0
                cursor.execute(
                    """
                    UPDATE virtual_accounts
                    SET cash_balance = cash_balance + %s, updated_at = NOW()
                    WHERE account_id = %s
                    """,
                    (proceeds, account_id),
                )
                remain = current_qty - quantity
                if remain > 0:
                    cursor.execute(
                        "UPDATE virtual_positions SET quantity = %s, updated_at = NOW() WHERE position_id = %s",
                        (remain, pos['position_id']),
                    )
                else:
                    cursor.execute("DELETE FROM virtual_positions WHERE position_id = %s", (pos['position_id'],))

            try:
                cursor.execute(
                    """
                    INSERT INTO virtual_orders (
                        account_id, stock_id, side, price, quantity, status,
                        fee_amount, tax_amount, executed_at, created_at
                    ) VALUES (%s, %s, %s, %s, %s, 'EXECUTED', %s, %s, NOW(), NOW())
                    """,
                    (account_id, stock_id, side, price, quantity, fee_c, tax_c),
                )
            except Exception as ins_err:
                err_low = str(ins_err).lower()
                if 'tax_amount' in err_low or 'unknown column' in err_low:
                    cursor.execute(
                        """
                        INSERT INTO virtual_orders (
                            account_id, stock_id, side, price, quantity, status,
                            fee_amount, executed_at, created_at
                        ) VALUES (%s, %s, %s, %s, %s, 'EXECUTED', %s, NOW(), NOW())
                        """,
                        (account_id, stock_id, side, price, quantity, fee_c),
                    )
                else:
                    raise
        conn.commit()

        if side == 'BUY':
            cash_after = cash_before - (total_amount + fee_c)
        else:
            cash_after = cash_before + (total_amount - fee_c - tax_c)
        try:
            with conn.cursor() as cur2:
                cur2.execute(
                    'SELECT cash_balance FROM virtual_accounts WHERE account_id = %s LIMIT 1',
                    (account_id,),
                )
                row_ca = cur2.fetchone()
                if row_ca is not None:
                    cash_after = _won_int(row_ca.get('cash_balance'))
        except Exception:
            pass

        return jsonify({
            'success': True,
            'message': f'{name} {quantity}주 {("매수" if side == "BUY" else "매도")} 체결',
            'cash_before': cash_before,
            'cash_after': cash_after,
            'trade': {
                'side': side,
                'code': code,
                'name': name,
                'price': price,
                'quantity': quantity,
                'gross': total_amount,
                'total': total_amount,
                'fee': fee_c,
                'tax': tax_c,
                'net_settlement': (-(total_amount + fee_c)) if side == 'BUY' else (total_amount - fee_c - tax_c),
                'commission_rate_note': '0.015%',
                'tax_rate_note': '0.18% (매도)' if side == 'SELL' else None,
            },
        })
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': f'모의 주문 처리 실패: {e}'}), 500
    finally:
        if conn:
            conn.close()

# KIS 지수 API 필드 추출.
def _kis_index_price_fields(out):
    """KIS 지수 API 필드 추출."""
    if not out:
        return None, None, None
    pr = out.get('bstp_nmix_prpr') or out.get('BSTP_NMIX_PRPR')
    dv = out.get('bstp_nmix_prdy_vrss') or out.get('BSTP_NMIX_PRDY_VRSS')
    rt = out.get('bstp_nmix_prdy_ctrt') or out.get('BSTP_NMIX_PRDY_CTRT')
    return pr, dv, rt


# KIS 지수 값이 종목별 최소 구간에 들어가는지.
def _kis_index_row_seems_valid(name, value):
    """KIS 지수 값이 종목별 최소 구간에 들어가는지."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return False
    if name == 'KOSPI':
        return v >= 500.0
    if name == 'KOSDAQ':
        return v >= 100.0
    if name == 'KOSPI 200':
        return v >= 50.0
    return v > 0.0


def _attach_sparkline_points(row, ticker, max_points=36):
    """카드·레일 미니차트용 최근 구간 points 부착."""
    out = dict(row or {})
    if out.get('error'):
        return out
    existing = out.get('points')
    if isinstance(existing, list) and len(existing) >= 2:
        return out
    if not ticker:
        return out
    try:
        hist = yf.Ticker(ticker).history(period='5d', interval='30m', auto_adjust=False)
        closes = hist['Close'].dropna() if hist is not None and not hist.empty else None
        points = _series_to_recent_points(closes, max_points=max_points)
        if len(points) >= 2:
            out['points'] = points
            prev = _series_to_prev_session_close(closes)
            if prev is not None:
                out.setdefault('reference_value', round(prev, 2))
            out.setdefault('chart_mode', 'relative')
    except Exception:
        pass
    return out


# Yahoo Finance 지수 (최근 5일 30분봉 + 스파크라인 points).
def _yf_index_from_ticker(name, ticker, kind='index'):
    """Yahoo Finance 지수 (최근 5일 30분봉 + 스파크라인 points)."""
    hist = yf.Ticker(ticker).history(period='5d', interval='30m', auto_adjust=False)
    closes = hist['Close'].dropna() if hist is not None and not hist.empty else None
    if closes is None or len(closes) < 2:
        raise ValueError('데이터 없음')
    curr_close = float(closes.iloc[-1])
    prev_close = _series_to_prev_session_close(closes)
    if prev_close is None or prev_close <= 0:
        prev_close = float(closes.iloc[-2]) if len(closes) >= 2 else curr_close

    change_abs = curr_close - prev_close
    change_pct = (change_abs / prev_close * 100) if prev_close else 0.0
    direction = 'up' if change_abs > 0 else ('down' if change_abs < 0 else 'flat')
    value_rounded = round(curr_close, 2)
    arrow = '▲' if direction == 'up' else ('▼' if direction == 'down' else '-')
    sign = '+' if direction == 'up' else ('-' if direction == 'down' else '')
    points = _series_to_recent_points(closes, max_points=36)
    return {
        'name': name,
        'value': value_rounded,
        'change_abs': round(change_abs, 2),
        'change_pct': round(change_pct, 2),
        'direction': direction,
        'source': 'yfinance',
        'kind': kind,
        'value_text': _format_index_value_text(value_rounded, kind),
        'change_text': f"{arrow} {abs(change_pct):.2f}%",
        'points': points,
        'reference_value': round(prev_close, 2),
        'chart_mode': 'relative',
    }


def _index_row_with_key(name, row, key=None):
    out = dict(row or {})
    out['name'] = str(out.get('name') or name)
    resolved_key = str(key or out.get('key') or _INDEX_NAME_TO_KEY.get(out['name']) or _INDEX_NAME_TO_KEY.get(name) or '').strip()
    out['key'] = resolved_key
    meta = _INDEX_KEY_META.get(resolved_key, {})
    out.setdefault('region', meta.get('region', 'GLOBAL'))
    out.setdefault('region_label', meta.get('region_label', ''))
    out.setdefault('kind', meta.get('kind', 'index'))
    if 'interactive' not in out:
        out['interactive'] = bool(meta.get('interactive', True))
    return out


def _format_index_value_text(value, kind='index'):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return '-'
    if kind == 'fx':
        return f'{v:,.2f}'
    if kind == 'commodity':
        return f'{v:,.2f}'
    if v >= 1000:
        return f'{v:,.2f}'
    return f'{v:,.2f}'


def _fetch_global_macro_row(spec):
    """글로벌·원자재 지표 1건 (yfinance / FX)."""
    key = str(spec.get('key') or '').strip()
    name = str(spec.get('name') or key)
    kind = spec.get('kind', 'index')
    if key == 'usdkrw':
        try:
            payload, _cached, _ts = _fx_usd_krw_payload()
            payload = dict(payload)
            payload['interactive'] = True
            payload['inline_chart'] = False
            return _index_row_with_key(name, payload, key=key)
        except Exception as exc:
            return _index_row_with_key(name, {'name': name, 'error': str(exc)}, key=key)
    ticker = spec.get('yf_ticker') or _INDEX_KEY_TO_YF_TICKER.get(key)
    if not ticker:
        return _index_row_with_key(name, {'name': name, 'error': '티커 없음'}, key=key)
    try:
        row = _yf_index_from_ticker(name, ticker, kind=kind)
        return _index_row_with_key(name, row, key=key)
    except Exception as exc:
        return _index_row_with_key(name, {'name': name, 'error': str(exc)}, key=key)


def _series_to_latest_session_points(series, max_points=96):
    closes = series.dropna() if series is not None else None
    if closes is None or closes.empty:
        return []
    idx = closes.index
    if not isinstance(idx, pd.DatetimeIndex):
        return []
    local_idx = idx.tz_convert('Asia/Seoul') if idx.tz is not None else idx
    last_day = pd.Timestamp(local_idx[-1]).date()
    mask = [pd.Timestamp(ts).date() == last_day for ts in local_idx]
    session = closes[mask]
    if session.empty:
        session = closes
    if len(session) > max_points:
        session = session.iloc[-max_points:]
    points = []
    for ts, value in session.items():
        try:
            stamp = pd.Timestamp(ts)
            points.append({
                'time': int(stamp.timestamp() * 1000),
                'value': round(float(value), 2),
            })
        except Exception:
            continue
    return points


def _series_to_recent_points(series, max_points=60):
    closes = series.dropna() if series is not None else None
    if closes is None or closes.empty:
        return []
    if len(closes) > max_points:
        closes = closes.iloc[-max_points:]
    points = []
    for ts, value in closes.items():
        try:
            stamp = pd.Timestamp(ts)
            points.append({
                'time': int(stamp.timestamp() * 1000),
                'value': round(float(value), 2),
            })
        except Exception:
            continue
    return points


def _series_to_prev_session_close(series):
    closes = series.dropna() if series is not None else None
    if closes is None or len(closes) < 2:
        return None
    idx = closes.index
    if not isinstance(idx, pd.DatetimeIndex):
        return None
    local_idx = idx.tz_convert('Asia/Seoul') if idx.tz is not None else idx
    last_day = pd.Timestamp(local_idx[-1]).date()
    for pos in range(len(closes) - 1, -1, -1):
        try:
            cur_day = pd.Timestamp(local_idx[pos]).date()
        except Exception:
            continue
        if cur_day != last_day:
            try:
                return float(closes.iloc[pos])
            except Exception:
                return None
    return None


def _series_to_daily_points(series, max_points=20):
    closes = series.dropna() if series is not None else None
    if closes is None or closes.empty:
        return []
    if len(closes) > max_points:
        closes = closes.iloc[-max_points:]
    points = []
    for ts, value in closes.items():
        try:
            stamp = pd.Timestamp(ts)
            if stamp.tzinfo is not None:
                stamp = stamp.tz_convert('Asia/Seoul')
            stamp = stamp.tz_localize(None) if stamp.tzinfo is not None else stamp
            stamp = stamp.replace(hour=12, minute=0, second=0, microsecond=0)
            points.append({
                'time': int(stamp.timestamp() * 1000),
                'value': round(float(value), 2),
            })
        except Exception:
            continue
    return points


def _index_history_payload_from_points(key, name, points, source, intraday, reference_value=None, reference_label=None):
    if not points or len(points) < 2:
        raise ValueError('지수 히스토리 데이터가 부족합니다.')
    first = float(points[0]['value'])
    last = float(points[-1]['value'])
    basis = _safe_float(reference_value, 0.0) if reference_value is not None else 0.0
    if basis <= 0:
        basis = first
    change_abs = last - basis
    change_pct = (change_abs / basis * 100.0) if basis else 0.0
    direction = 'up' if change_abs > 0 else ('down' if change_abs < 0 else 'flat')
    return {
        'key': key,
        'name': name,
        'intraday': bool(intraday),
        'points': points,
        'value': round(last, 2),
        'change_abs': round(change_abs, 2),
        'change_pct': round(change_pct, 2),
        'direction': direction,
        'source': source,
        'reference_value': round(basis, 2),
        'reference_label': reference_label or ('전일 종가' if intraday else '기준값'),
        'window_start_value': round(first, 2),
        'window_change_abs': round(last - first, 2),
        'window_change_pct': round(((last - first) / first * 100.0) if first else 0.0, 2),
    }


def _yf_index_recent_5d_payload(key, name, ticker):
    hist = yf.Ticker(ticker).history(period='5d', interval='30m', auto_adjust=False)
    closes = hist['Close'] if hist is not None and not hist.empty and 'Close' in hist else None
    points = _series_to_recent_points(closes, max_points=60)
    prev_close = _series_to_prev_session_close(closes)
    payload = _index_history_payload_from_points(
        key, name, points, 'yfinance-30m', False,
        reference_value=prev_close, reference_label='전일 종가'
    )
    payload['range_label'] = '최근 5거래일'
    payload['window'] = '5d'
    return payload


def _yf_index_5d_fallback_payload(key, name, ticker):
    hist = yf.Ticker(ticker).history(period='3mo', interval='1d', auto_adjust=False)
    closes = hist['Close'] if hist is not None and not hist.empty and 'Close' in hist else None
    points = _series_to_daily_points(closes, max_points=5)
    prev_close = _series_to_prev_session_close(closes)
    payload = _index_history_payload_from_points(
        key, name, points, 'yfinance-1d', False,
        reference_value=prev_close, reference_label='전일 종가'
    )
    payload['fallback'] = 'daily'
    payload['range_label'] = '최근 5거래일 종가'
    payload['window'] = '5d'
    return payload


def _hist_last_calendar_days(hist: pd.DataFrame, days: int) -> pd.DataFrame:
    """히스토리에서 최근 N일 구간만 반환."""
    if hist is None or hist.empty or days <= 0:
        return hist
    try:
        idx = hist.index
        if len(idx) == 0:
            return hist
        cutoff = idx[-1] - pd.Timedelta(days=days)
        clipped = hist.loc[idx >= cutoff]
        return clipped if clipped is not None and not clipped.empty else hist
    except Exception:
        return hist


_INDEX_RANGE_YF = {
    # 1일: 최근 1개월 30분봉(줌·스크롤). 초기 뷰는 프론트에서 최근 구간만 확대.
    '1d': ('1mo', '30m', True, 800),
    '1w': ('1mo', '1h', False, 200),
    '1m': ('6mo', '1d', False, 130),
    '1y': ('5y', '1wk', False, 260),
}
_INDEX_RANGE_LABELS = {
    '1d': '1일',
    '1w': '1주',
    '1m': '1개월',
    '1y': '1년',
}


def _hist_last_n_trading_sessions(hist: pd.DataFrame, max_sessions: int = 15) -> pd.DataFrame:
    """분봉 히스토리에서 최근 N거래일 구간만 반환 (1일 차트용)."""
    if hist is None or hist.empty or max_sessions <= 0:
        return hist
    try:
        idx = hist.index
        if not isinstance(idx, pd.DatetimeIndex):
            return hist
        local_idx = idx.tz_convert('Asia/Seoul') if idx.tz is not None else idx
        session_days = []
        for ts in reversed(local_idx):
            d = pd.Timestamp(ts).date()
            if not session_days or session_days[-1] != d:
                session_days.append(d)
            if len(session_days) >= max_sessions:
                break
        if not session_days:
            return hist
        keep = set(session_days)
        mask = [pd.Timestamp(local_idx[i]).date() in keep for i in range(len(hist))]
        sliced = hist.loc[mask]
        return sliced if sliced is not None and not sliced.empty else hist
    except Exception:
        return hist


def _hist_last_session_slice(hist: pd.DataFrame) -> pd.DataFrame:
    """분봉 히스토리에서 최근 거래일 구간만 반환."""
    if hist is None or hist.empty:
        return hist
    try:
        idx = hist.index
        if not isinstance(idx, pd.DatetimeIndex):
            return hist
        local_idx = idx.tz_convert('Asia/Seoul') if idx.tz is not None else idx
        last_day = pd.Timestamp(local_idx[-1]).date()
        mask = [pd.Timestamp(local_idx[i]).date() == last_day for i in range(len(hist))]
        sliced = hist.loc[mask]
        return sliced if not sliced.empty else hist
    except Exception:
        return hist


def _ohlcv_stats_from_hist(hist: pd.DataFrame, *, intraday: bool = False) -> dict:
    """선택 구간 OHLCV 통계 (지수 상세 오버레이용)."""
    if hist is None or hist.empty:
        return {'open': None, 'high': None, 'low': None, 'volume': None}
    frame = _hist_last_session_slice(hist) if intraday else hist
    if frame is None or frame.empty:
        frame = hist
    try:
        open_s = frame['Open'] if 'Open' in frame.columns else frame['Close']
        high_s = frame['High'] if 'High' in frame.columns else frame['Close']
        low_s = frame['Low'] if 'Low' in frame.columns else frame['Close']
        vol_s = frame['Volume'] if 'Volume' in frame.columns else None
        o = float(open_s.iloc[0])
        h = float(high_s.max())
        l = float(low_s.min())
        vol = None
        if vol_s is not None and not vol_s.dropna().empty:
            vol = float(vol_s.dropna().sum())
        return {
            'open': round(o, 2),
            'high': round(h, 2),
            'low': round(l, 2),
            'volume': round(vol, 0) if vol is not None and math.isfinite(vol) else None,
        }
    except Exception:
        return {'open': None, 'high': None, 'low': None, 'volume': None}


def _yf_index_range_payload(key, name, ticker, range_param: str):
    """기간별 지수 차트 (1d/1w/1m/1y). 줌·스크롤용 촘촘한 봉 데이터 포함."""
    spec = _INDEX_RANGE_YF.get(range_param)
    if not spec:
        raise ValueError('지원하지 않는 기간입니다.')
    period, interval, intraday_flag, max_points = spec
    chart_intraday = bool(intraday_flag or interval in ('30m', '1h', '60m', '15m', '5m'))
    hist = yf.Ticker(ticker).history(period=period, interval=interval, auto_adjust=False)
    if hist is None or hist.empty or 'Close' not in hist:
        raise ValueError('지수 히스토리 데이터가 부족합니다.')
    closes = hist['Close'].dropna()
    if closes.empty or len(closes) < 2:
        raise ValueError('지수 히스토리 데이터가 부족합니다.')
    if intraday_flag:
        points = _series_to_latest_session_points(closes, max_points=max_points)
        prev_close = _series_to_prev_session_close(closes)
        source = f'yfinance-{interval}'
    else:
        points = _series_to_daily_points(closes, max_points=max_points)
        prev_close = float(closes.iloc[-2]) if len(closes) >= 2 else None
        source = f'yfinance-{interval}'
    payload = _index_history_payload_from_points(
        key,
        name,
        points,
        source,
        intraday_flag,
        reference_value=prev_close,
        reference_label='전일 종가',
    )
    payload['range'] = range_param
    payload['range_label'] = _INDEX_RANGE_LABELS.get(range_param, range_param)
    if range_param == '1d' and intraday_flag:
        payload['range_label'] = '1일 · 최근 거래일 분봉 (좌우 이동)'
    meta = _INDEX_KEY_META.get(key, {})
    payload['region'] = meta.get('region', 'KR' if key in ('kospi', 'kosdaq', 'kospi200') else 'GLOBAL')
    payload['region_label'] = meta.get('region_label', '한국' if payload['region'] == 'KR' else '')
    payload['kind'] = meta.get('kind', 'index')

    if intraday_flag and range_param == '1d':
        chart_hist = _hist_last_n_trading_sessions(hist, max_sessions=15)
    elif intraday_flag:
        chart_hist = _hist_last_session_slice(hist)
    elif range_param == '1w':
        chart_hist = _hist_last_calendar_days(hist, 7)
    elif range_param == '1m':
        chart_hist = _hist_last_calendar_days(hist, 31)
    else:
        chart_hist = hist
    if chart_hist is not None and len(chart_hist) > max_points:
        chart_hist = chart_hist.iloc[-max_points:]

    stats_hist = _hist_last_session_slice(hist) if intraday_flag else chart_hist
    payload['stats'] = _ohlcv_stats_from_hist(stats_hist, intraday=intraday_flag)
    if intraday_flag:
        payload['volume_label'] = '당일(최근 거래일) 거래량'
    elif range_param in ('1w', '1m', '1y'):
        payload['volume_label'] = '구간 거래량'
    elif payload.get('kind') == 'commodity':
        payload['volume_label'] = '거래량(선물)'
    else:
        payload['volume_label'] = '거래량'

    chart_payload = _build_chart_payload_from_hist(chart_hist, chart_intraday)
    if chart_payload:
        payload['candles'] = chart_payload.get('candles') or []
        payload['ma5'] = chart_payload.get('ma5') or []
        payload['ma20'] = chart_payload.get('ma20') or []
        payload['intraday'] = bool(chart_payload.get('intraday'))
        _merge_daily_ma_into_chart_payload_yf(payload, ticker)
    return payload


def _fx_usd_krw_payload(now=None):
    now_ts = time.time() if now is None else float(now)
    cached = _FX_USD_KRW_CACHE['payload']
    if cached and (now_ts - _FX_USD_KRW_CACHE['ts']) < _FX_USD_KRW_TTL:
        return dict(cached), True, datetime.fromtimestamp(_FX_USD_KRW_CACHE['ts']).strftime('%H:%M:%S')

    hist = yf.Ticker('KRW=X').history(period='5d', interval='30m', auto_adjust=False)
    if hist is None or hist.empty:
        raise ValueError('환율 데이터 없음')
    closes = hist['Close'].dropna()
    if closes.empty:
        raise ValueError('환율 데이터 없음')

    points = _series_to_recent_points(closes, max_points=60)
    curr = float(closes.iloc[-1])
    prev = _series_to_prev_session_close(closes)
    if prev is None or prev <= 0:
        prev = float(closes.iloc[-2]) if len(closes) >= 2 else curr
    change_abs = curr - prev
    change_pct = (change_abs / prev * 100) if prev else 0.0
    direction = 'up' if change_abs > 0 else ('down' if change_abs < 0 else 'flat')
    payload = {
        'key': 'usdkrw',
        'kind': 'fx',
        'interactive': True,
        'inline_chart': False,
        'name': 'USD/KRW',
        'value': round(curr, 2),
        'change_abs': round(change_abs, 2),
        'change_pct': round(change_pct, 2),
        'direction': direction,
        'source': 'yfinance',
        'value_text': f"{curr:,.2f}",
        'change_text': f"{'▲' if direction == 'up' else '▼' if direction == 'down' else '-'} {abs(change_pct):.2f}%",
        'points': points,
        'reference_value': round(prev, 2),
        'range_label': '최근 5거래일',
        'chart_mode': 'relative',
        'reference_label': '전일 종가',
    }
    _FX_USD_KRW_CACHE['payload'] = payload
    _FX_USD_KRW_CACHE['ts'] = now_ts
    return dict(payload), False, datetime.now().strftime('%H:%M:%S')


def _market_breadth_history_points(all_items, max_points=5):
    codes = [code for code, _ in (all_items or []) if code]
    if not codes:
        return []
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT date
                FROM stock_price_daily
                ORDER BY date DESC
                LIMIT %s
                """,
                (max_points,),
            )
            recent_dates = [row.get('date') for row in cur.fetchall() or [] if row.get('date')]
            if not recent_dates:
                return []
            ph_codes = ','.join(['%s'] * len(codes))
            ph_dates = ','.join(['%s'] * len(recent_dates))
            cur.execute(
                f"""
                SELECT sp.date, s.symbol, sp.close_price, sp.prev_close
                FROM stocks s
                JOIN stock_price_daily sp ON sp.stock_id = s.stock_id
                WHERE s.symbol IN ({ph_codes})
                  AND sp.date IN ({ph_dates})
                ORDER BY sp.date ASC
                """,
                tuple(codes) + tuple(recent_dates),
            )
            rows = cur.fetchall() or []
    except Exception:
        return []
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

    by_date = {}
    for row in rows:
        d = row.get('date')
        if not d:
            continue
        bucket = by_date.setdefault(d, {'up': 0, 'down': 0, 'flat': 0})
        try:
            close_price = float(row.get('close_price') or 0.0)
            prev_close = float(row.get('prev_close') or 0.0)
        except (TypeError, ValueError):
            close_price = 0.0
            prev_close = 0.0
        if close_price > prev_close > 0:
            bucket['up'] += 1
        elif prev_close > 0 and close_price < prev_close:
            bucket['down'] += 1
        else:
            bucket['flat'] += 1

    points = []
    for d in sorted(by_date.keys()):
        score = int(by_date[d]['up']) - int(by_date[d]['down'])
        points.append({
            'time': int(datetime(d.year, d.month, d.day, 12, 0, 0).timestamp() * 1000),
            'value': score,
        })
    return points


def _market_breadth_direction(row):
    direction = str((row or {}).get('direction') or '').strip().lower()
    if direction in ('up', 'down', 'flat'):
        return direction
    return 'flat'


def _market_breadth_payload(token=None):
    all_items = _get_live_price_universe_items()
    universe_count = len(all_items)
    if universe_count <= 0:
        return {
            'key': 'marketbreadth',
            'kind': 'breadth',
            'interactive': True,
            'inline_chart': False,
            'name': '시장폭',
            'direction': 'flat',
            'value_text': '-',
            'change_text': '집계 불가',
            'up_count': 0,
            'down_count': 0,
            'flat_count': 0,
            'available_count': 0,
            'universe_count': 0,
            'points': [],
            'reference_value': 0,
            'chart_mode': 'score',
            'reference_label': '중립선',
        }

    market_open = _live_fetch_enabled_now()
    snapshot = {}
    if fetch_live_snapshot_batch:
        try:
            snapshot = fetch_live_snapshot_batch([code for code, _ in all_items]) or {}
        except Exception:
            snapshot = {}

    if market_open:
        rows = _ordered_stock_rows(all_items, snapshot)
    else:
        rows = []
        for code, name in all_items:
            row = snapshot.get(code)
            if row:
                rows.append({**row, 'name': name})
                continue
            cached_row = None
            if _LIVE_OFFHOURS_USE_CACHE:
                with _LIVE_PRICE_LOCK:
                    cached = _LIVE_PRICE_CACHE.get(code)
                if cached and not cached.get('loading') and cached.get('price') is not None:
                    cached_row = {**cached, 'name': name, 'stale': True}
            if cached_row:
                rows.append(cached_row)
            else:
                rows.append({'code': code, 'name': name, 'loading': True})
        if _LIVE_OFFHOURS_YFINANCE:
            _offhours_fill_yfinance_rows(rows, all_items, min(max(6, _LIVE_OFFHOURS_YF_BUDGET), universe_count))

    up_count = 0
    down_count = 0
    flat_count = 0
    available_count = 0
    for row in rows:
        if row.get('loading'):
            continue
        available_count += 1
        direction = _market_breadth_direction(row)
        if direction == 'up':
            up_count += 1
        elif direction == 'down':
            down_count += 1
        else:
            flat_count += 1

    score = up_count - down_count
    direction = 'up' if score > 0 else ('down' if score < 0 else 'flat')
    change_label = '상승 우세' if direction == 'up' else '하락 우세' if direction == 'down' else '균형'
    coverage_suffix = '' if available_count >= universe_count else f' · 집계 {available_count}/{universe_count}'
    points = _market_breadth_history_points(all_items, max_points=5)
    return {
        'key': 'marketbreadth',
        'kind': 'breadth',
        'interactive': True,
        'inline_chart': False,
        'name': '시장폭',
        'value': score,
        'change_abs': score,
        'change_pct': score,
        'direction': direction,
        'value_text': f'{up_count} / {down_count}',
        'change_text': change_label,
        'up_count': up_count,
        'down_count': down_count,
        'flat_count': flat_count,
        'available_count': available_count,
        'universe_count': universe_count,
        'breadth_score': score,
        'source': 'live-prices',
        'points': points,
        'reference_value': 0,
        'range_label': f'최근 5거래일 · 주요 {universe_count}종목 기준{coverage_suffix}',
        'chart_mode': 'score',
        'reference_label': '중립선',
    }


# KIS 지수 현재가 조회.
def _kis_fetch_index_price(token, fid_input_iscd):
    """KIS 지수 현재가 조회."""
    for tr_id in (_KIS_INDEX_TR, _KIS_INDEX_TR_FB):
        try:
            res = requests.get(
                f'{_KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-price',
                headers={
                    'Content-Type': 'application/json',
                    'authorization': f'Bearer {token}',
                    'appkey': _KIS_KEY,
                    'appsecret': _KIS_SECRET,
                    'tr_id': tr_id,
                    'custtype': 'P',
                },
                params={'fid_cond_mrkt_div_code': 'U', 'fid_input_iscd': fid_input_iscd},
                timeout=10,
            )
            body = res.json()
        except Exception as e:
            continue
        if res.status_code != 200:
            continue
        rt = body.get('rt_cd')
        if str(rt) != '0':
            continue
        out = body.get('output')
        if isinstance(out, list):
            out = out[0] if out else None
        if out:
            return out, None
    return None, 'KIS 지수 조회 실패'


# KIS 지수 응답 → 지수 행 dict.
def _kis_index_output_to_row(name, out):
    """KIS 지수 응답 → 지수 행 dict."""
    sign = str(out.get('prdy_vrss_sign') or out.get('PRDY_VRSS_SIGN') or '3')
    direction = 'up' if sign in ('1', '2') else 'down' if sign in ('4', '5') else 'flat'
    pr, dv, rt = _kis_index_price_fields(out)
    value = _to_float(pr)
    change_abs = _to_float(dv)
    change_pct = _to_float(rt)
    return {
        'name': name,
        'value': round(value, 2),
        'change_abs': round(change_abs, 2),
        'change_pct': round(change_pct, 2),
        'direction': direction,
        'source': 'kis',
    }


# 주요 시장 지수 (캐시).
def serve_market_indices():
    """주요 시장 지수 (캐시). 한국 indices + global 매크로 + extras(시장폭)."""
    now = time.time()
    if now - _INDEX_CACHE['ts'] < _INDEX_CACHE_TTL and _INDEX_CACHE['data']:
        cached_indices = _INDEX_CACHE['data']
        cached_global = _INDEX_CACHE.get('global') or []
        cached_extras = _INDEX_CACHE.get('extras') or []
        return jsonify({
            'success': True,
            'indices': cached_indices,
            'global': cached_global,
            'extras': cached_extras,
            'cards': list(cached_indices) + list(cached_global) + list(cached_extras),
            'ticker_order': _TICKER_DISPLAY_ORDER,
            'cached': True,
            'ts': datetime.fromtimestamp(_INDEX_CACHE['ts']).strftime('%H:%M:%S'),
        })

    result = []
    token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None

    if token:
        for i, (name, fid) in enumerate(_KIS_INDEX_ROWS_FIXED):
            if i > 0 and _WEB_REQUEST_GAP_SEC > 0:
                time.sleep(min(_WEB_REQUEST_GAP_SEC, 0.25))
            out, _err = _kis_fetch_index_price(token, fid)
            if out:
                try:
                    row = _index_row_with_key(name, _kis_index_output_to_row(name, out))
                    if _kis_index_row_seems_valid(name, row.get('value')):
                        yft_kis = _INDEX_YF_TICKERS.get(name)
                        if yft_kis:
                            row = _attach_sparkline_points(row, yft_kis)
                        result.append(row)
                        continue
                except Exception:
                    pass
            yft = _INDEX_YF_TICKERS.get(name)
            if yft:
                try:
                    result.append(_index_row_with_key(name, _yf_index_from_ticker(name, yft, kind='index')))
                except Exception as e:
                    result.append(_index_row_with_key(name, {'name': name, 'error': str(e)}))
            else:
                result.append(_index_row_with_key(name, {'name': name, 'error': _err or '조회 실패'}))
    else:
        for name, yft in _INDEX_YF_TICKERS.items():
            try:
                result.append(_index_row_with_key(name, _yf_index_from_ticker(name, yft, kind='index')))
            except Exception as e:
                result.append(_index_row_with_key(name, {'name': name, 'error': str(e)}))

    global_rows = []
    try:
        with ThreadPoolExecutor(max_workers=min(8, len(_GLOBAL_MACRO_ROWS) or 1)) as pool:
            futures = [pool.submit(_fetch_global_macro_row, spec) for spec in _GLOBAL_MACRO_ROWS]
            for fut in futures:
                try:
                    global_rows.append(fut.result())
                except Exception as exc:
                    global_rows.append({'name': '지표', 'error': str(exc), 'interactive': False})
    except Exception:
        for spec in _GLOBAL_MACRO_ROWS:
            global_rows.append(_fetch_global_macro_row(spec))

    extras = []
    try:
        extras.append(_market_breadth_payload(token=token))
    except Exception as breadth_exc:
        extras.append({
            'key': 'marketbreadth',
            'kind': 'breadth',
            'interactive': False,
            'inline_chart': True,
            'name': '시장폭',
            'direction': 'flat',
            'error': str(breadth_exc),
            'value_text': '-',
            'change_text': '조회 실패',
            'points': [],
            'reference_value': 0,
            'chart_mode': 'score',
        })

    _INDEX_CACHE['data'] = result
    _INDEX_CACHE['global'] = global_rows
    _INDEX_CACHE['extras'] = extras
    _INDEX_CACHE['ts'] = now
    return jsonify({
        'success': True,
        'indices': result,
        'global': global_rows,
        'extras': extras,
        'cards': list(result) + list(global_rows) + list(extras),
        'ticker_order': _TICKER_DISPLAY_ORDER,
        'cached': False,
        'ts': datetime.now().strftime('%H:%M:%S'),
    })


def serve_market_index_history(index_key):
    """주요 지수 차트. range 없음=5거래일(레거시 팝오버), range=1d|1w|1m|1y=상세 오버레이."""
    key = str(index_key or '').strip().lower()
    if not key:
        return jsonify({'success': False, 'message': '지원하지 않는 지수입니다.'}), 404

    range_param = str(request.args.get('range') or '').strip().lower()
    if range_param and range_param not in _INDEX_RANGE_YF:
        return jsonify({'success': False, 'message': '지원하지 않는 기간입니다. (1d, 1w, 1m, 1y)'}), 400

    cache_key = (key, range_param or 'legacy')
    now = time.time()
    cached = _INDEX_HISTORY_CACHE.get(cache_key)
    if cached and (now - float(cached.get('ts') or 0.0)) < _INDEX_HISTORY_TTL:
        payload = dict(cached.get('payload') or {})
        payload.update({
            'success': True,
            'cached': True,
            'ts': datetime.fromtimestamp(float(cached.get('ts') or now)).strftime('%H:%M:%S'),
        })
        return jsonify(payload)

    try:
        if key == 'marketbreadth':
            payload = _market_breadth_payload()
        elif key in _INDEX_KEY_TO_NAME and key in _INDEX_KEY_TO_YF_TICKER:
            name = _INDEX_KEY_TO_NAME.get(key)
            ticker = _INDEX_KEY_TO_YF_TICKER.get(key)
            if range_param:
                payload = _yf_index_range_payload(key, name, ticker, range_param)
            elif key == 'usdkrw':
                payload, _cached, _ts = _fx_usd_krw_payload(now=now)
                payload = dict(payload)
                meta = _INDEX_KEY_META.get(key, {})
                payload.setdefault('region', meta.get('region', 'KR'))
                payload.setdefault('region_label', meta.get('region_label', '환율'))
                payload.setdefault('kind', 'fx')
            else:
                payload = _yf_index_recent_5d_payload(key, name, ticker)
        else:
            return jsonify({'success': False, 'message': '지원하지 않는 지수입니다.'}), 404
    except Exception:
        try:
            if key == 'marketbreadth':
                raise
            if key in _INDEX_KEY_TO_NAME and key in _INDEX_KEY_TO_YF_TICKER:
                name = _INDEX_KEY_TO_NAME.get(key)
                ticker = _INDEX_KEY_TO_YF_TICKER.get(key)
                if range_param:
                    raise
                payload = _yf_index_5d_fallback_payload(key, name, ticker)
            else:
                return jsonify({'success': False, 'message': '지원하지 않는 지수입니다.'}), 404
        except Exception as exc:
            return jsonify({'success': False, 'message': f'지수 차트 조회 실패: {exc}'}), 200

    _INDEX_HISTORY_CACHE[cache_key] = {'payload': payload, 'ts': now}
    body = dict(payload)
    body.update({'success': True, 'cached': False, 'ts': datetime.now().strftime('%H:%M:%S')})
    return jsonify(body)


# USD/KRW 환율.
def serve_fx_usd_krw():
    """USD/KRW 환율."""
    try:
        payload, is_cached, ts = _fx_usd_krw_payload()
        return jsonify({
            'success': True,
            **payload,
            'cached': bool(is_cached),
            'ts': ts,
        })
    except Exception as e:
        if '데이터 없음' in str(e):
            return jsonify({'success': False, 'message': str(e)}), 404
        return jsonify({'success': False, 'message': str(e)}), 502


# 분봉에서 최근 거래일만 남김.
def _trim_intraday_to_last_session_day(hist: pd.DataFrame) -> pd.DataFrame:
    """분봉에서 최근 거래일만 남김."""
    if hist is None or getattr(hist, 'empty', True):
        return hist
    try:
        idx = hist.index
        if len(idx) == 0:
            return hist
        last = idx[-1]
        if hasattr(last, 'date'):
            d = last.date()
            mask = []
            for t in idx:
                td = t.date() if hasattr(t, 'date') else None
                mask.append(td == d)
            pick = [i for i, m in enumerate(mask) if m]
            trimmed = hist.iloc[pick] if pick else hist.iloc[0:0]
            if trimmed is not None and not trimmed.empty:
                return trimmed
    except Exception:
        pass
    return hist


# fallback으로 더 긴 기간을 받아도 요청 구간에 맞게 절단.
def _clip_hist_to_requested_range(hist: pd.DataFrame, range_param: str, intraday: bool) -> pd.DataFrame:
    """fallback으로 더 긴 기간을 받아도 요청 구간에 맞게 절단."""
    if hist is None or getattr(hist, 'empty', True):
        return hist
    rp = str(range_param or '').strip().lower()

    if intraday and rp == '1d':
        return _trim_intraday_to_last_session_day(hist)

    # Toss 스타일 일·주·월·년봉: 최근 달력 구간만 유지 (과다 데이터 방지)
    keep_days_map = {
        '1d': 800,
        '1w': 2200,
        '1m': 4000,
        '1y': 50 * 365,
    }
    keep_days = keep_days_map.get(rp)
    if not keep_days:
        return hist
    try:
        idx = hist.index
        if len(idx) == 0:
            return hist
        last = idx[-1]
        cutoff = last - pd.Timedelta(days=keep_days)
        clipped = hist.loc[idx >= cutoff]
        if clipped is not None and not clipped.empty:
            return clipped
    except Exception:
        pass
    return hist


# yfinance 3개월봉 등 → 연도별 OHLC 1봉 (토스 년봉 폴백).
def _hist_aggregate_to_yearly(hist: pd.DataFrame) -> pd.DataFrame:
    """yfinance 3개월봉 등 → 연도별 OHLC 1봉 (토스 년봉 폴백)."""
    if hist is None or getattr(hist, 'empty', True):
        return hist
    try:
        parts = []
        for _year, grp in hist.groupby(hist.index.year):
            if grp is None or getattr(grp, 'empty', True):
                continue
            idx = grp.index[-1]
            parts.append(
                (
                    idx,
                    {
                        'Open': float(grp['Open'].iloc[0]),
                        'High': float(grp['High'].max()),
                        'Low': float(grp['Low'].min()),
                        'Close': float(grp['Close'].iloc[-1]),
                    },
                )
            )
        if not parts:
            return hist
        idxs = [p[0] for p in parts]
        data = {k: [p[1][k] for p in parts] for k in ('Open', 'High', 'Low', 'Close')}
        return pd.DataFrame(data, index=pd.DatetimeIndex(idxs)).sort_index()
    except Exception:
        return hist


# OHLCV → 차트용 캔들·이동평균.
def _build_chart_payload_from_hist(hist: pd.DataFrame, intraday: bool):
    """OHLCV → 차트용 캔들·이동평균."""
    if hist is None or hist.empty:
        return None
    candles = []
    for ts, row in hist.iterrows():
        o = row.get('Open')
        h = row.get('High')
        l = row.get('Low')
        c = row.get('Close')
        if pd.isna(o) or pd.isna(h) or pd.isna(l) or pd.isna(c):
            continue
        time_val = int(ts.timestamp()) if intraday else ts.strftime('%Y-%m-%d')
        candles.append({
            'time': time_val,
            'open': round(float(o), 2),
            'high': round(float(h), 2),
            'low': round(float(l), 2),
            'close': round(float(c), 2),
        })
    if not candles:
        return None

    closes = [x['close'] for x in candles]
    ma5, ma20 = [], []
    for i in range(len(closes)):
        if i >= 4:
            ma5.append({'time': candles[i]['time'], 'value': round(sum(closes[i - 4:i + 1]) / 5, 2)})
        if i >= 19:
            ma20.append({'time': candles[i]['time'], 'value': round(sum(closes[i - 19:i + 1]) / 20, 2)})

    return {
        'success': True,
        'candles': candles,
        'ma5': ma5,
        'ma20': ma20,
        'intraday': intraday,
    }


# 일봉 종가 SMA(5)·SMA(20)을 각 기간봉의 기준일(해당 일까지의 일봉)에 맞춤. cleaned.time 은 YYYY-MM-DD.
def _compute_daily_ma_aligned_to_candles(cleaned: list, daily: list[dict]) -> tuple[list, list] | None:
    """일봉 종가 SMA(5)·SMA(20)을 각 기간봉의 기준일(해당 일까지의 일봉)에 맞춤. cleaned.time 은 YYYY-MM-DD."""
    if not cleaned or not daily or len(daily) < 20:
        return None
    dates: list = []
    closes: list[float] = []
    for r in daily:
        ds = r.get('date') or r.get('time')
        if not isinstance(ds, str) or len(ds) < 10:
            continue
        try:
            dates.append(datetime.strptime(ds[:10], '%Y-%m-%d').date())
        except ValueError:
            continue
        try:
            closes.append(float(r['close']))
        except (TypeError, ValueError):
            continue
    if len(dates) < 20 or len(dates) != len(closes):
        return None
    ma5: list = []
    ma20: list = []
    j = 0
    n = len(dates)
    for c in cleaned:
        t = c.get('time')
        if not isinstance(t, str) or len(t) < 10:
            continue
        try:
            ct = datetime.strptime(t[:10], '%Y-%m-%d').date()
        except ValueError:
            continue
        while j < n and dates[j] <= ct:
            j += 1
        if j >= 5:
            ma5.append({'time': t, 'value': round(sum(closes[j - 5:j]) / 5, 2)})
        if j >= 20:
            ma20.append({'time': t, 'value': round(sum(closes[j - 20:j]) / 20, 2)})
    if not ma5 and not ma20:
        return None
    return ma5, ma20


# 차트 이평 정합용 일봉 종가 (오름차순). DB → KIS D.
def _daily_close_list_for_ma(code: str, token: str | None) -> list[dict] | None:
    """차트 이평 정합용 일봉 종가 (오름차순). DB → KIS D."""
    stock_id = _chart_resolve_stock_id(code)
    lim = max(_CHART_TARGET_BARS.get('D', 500), 900)
    if stock_id:
        rows = _db_load_daily_candles(stock_id, lim)
        if rows and len(rows) >= 20:
            return [{'date': r['date'], 'close': float(r['close'])} for r in rows]
    if token:
        dr = _kis_fetch_daily_chart(token, code, 'D')
        if dr and len(dr) >= 20:
            return [{'date': r['date'], 'close': float(r['close'])} for r in sorted(dr, key=lambda x: x['date'])]
    return None


# 주·월·연봉 응답의 ma5/ma20을 일봉 기준 5·20일 이평으로 덮어쓴다. 실패 시 기존(봉 기준) 유지.
def _merge_daily_ma_into_chart_payload(payload: dict, code: str, token: str | None) -> None:
    """주·월·연봉 응답의 ma5/ma20을 일봉 기준 5·20일 이평으로 덮어쓴다. 실패 시 기존(봉 기준) 유지."""
    candles = payload.get('candles') or []
    if not candles:
        return
    daily = _daily_close_list_for_ma(code, token)
    if not daily:
        return
    merged = _compute_daily_ma_aligned_to_candles(candles, daily)
    if not merged:
        return
    ma5, ma20 = merged
    payload['ma5'] = ma5
    payload['ma20'] = ma20


# yfinance 일봉 종가 (오름차순 date, close).
def _yf_fetch_daily_closes_for_ma(ticker_code: str) -> list[dict] | None:
    """yfinance 일봉 종가 (오름차순 date, close)."""
    try:
        tkr = yf.Ticker(ticker_code)
        hist = tkr.history(period='10y', interval='1d', auto_adjust=False, actions=False)
        if hist is None or getattr(hist, 'empty', True):
            hist = tkr.history(period='max', interval='1d', auto_adjust=False, actions=False)
        if hist is None or getattr(hist, 'empty', True):
            return None
        out: list[dict] = []
        for ts, row in hist.iterrows():
            c = row.get('Close')
            if pd.isna(c) or float(c) <= 0:
                continue
            ds = ts.strftime('%Y-%m-%d') if hasattr(ts, 'strftime') else str(ts)[:10]
            out.append({'date': ds, 'close': float(c)})
        return out if len(out) >= 20 else None
    except Exception:
        return None


# `_merge_daily_ma_into_chart_payload_yf` — 모듈 내부 헬퍼.
def _merge_daily_ma_into_chart_payload_yf(payload: dict, yahoo_ticker: str) -> None:
    if not yahoo_ticker:
        return
    candles = payload.get('candles') or []
    if not candles:
        return
    daily = _yf_fetch_daily_closes_for_ma(yahoo_ticker)
    if not daily:
        return
    merged = _compute_daily_ma_aligned_to_candles(candles, daily)
    if not merged:
        return
    ma5, ma20 = merged
    payload['ma5'] = ma5
    payload['ma20'] = ma20


# OHLC dict 리스트 → 차트용 캔들·이동평균 (_build_chart_payload_from_hist 와 동일 계산).
def _build_chart_payload_from_candles(candles, intraday):
    """OHLC dict 리스트 → 차트용 캔들·이동평균 (_build_chart_payload_from_hist 와 동일 계산)."""
    if not candles:
        return None
    cleaned = []
    for c in candles:
        try:
            o = float(c.get('open'))
            h = float(c.get('high'))
            l = float(c.get('low'))
            cl = float(c.get('close'))
        except (TypeError, ValueError):
            continue
        if o <= 0 or h <= 0 or l <= 0 or cl <= 0:
            continue
        tv = c.get('time')
        if tv is None:
            continue
        cleaned.append({
            'time': tv,
            'open': round(o, 2),
            'high': round(h, 2),
            'low': round(l, 2),
            'close': round(cl, 2),
        })
    if not cleaned:
        return None
    closes = [x['close'] for x in cleaned]
    ma5, ma20 = [], []
    for i in range(len(closes)):
        if i >= 4:
            ma5.append({'time': cleaned[i]['time'], 'value': round(sum(closes[i - 4:i + 1]) / 5, 2)})
        if i >= 19:
            ma20.append({'time': cleaned[i]['time'], 'value': round(sum(closes[i - 19:i + 1]) / 20, 2)})
    return {
        'success': True,
        'candles': cleaned,
        'ma5': ma5,
        'ma20': ma20,
        'intraday': intraday,
    }


# 종목 차트: 토스 스타일(일/주/월/년봉). KIS+DB 우선, 실패 시 yfinance.
def serve_chart_data(code):
    """종목 차트: 토스 스타일(일/주/월/년봉). KIS+DB 우선, 실패 시 yfinance."""
    range_param = str(request.args.get('range', '1d') or '1d').strip().lower()
    if range_param not in ('1d', '1w', '1m', '1y'):
        range_param = '1d'

    if _CHART_USE_KIS and _KIS_KEY and _KIS_SECRET:
        try:
            payload = _try_period_chart(code, range_param)
            if payload:
                payload['code'] = code
                payload['requested_range'] = range_param
                return jsonify(payload)
        except Exception:
            pass

    # (period, interval, 연도집계여부)
    range_attempts = {
        '1d': [('2y', '1d', False), ('5y', '1d', False)],
        '1w': [('5y', '1wk', False), ('10y', '1wk', False), ('max', '1wk', False)],
        '1m': [('10y', '1mo', False), ('max', '1mo', False)],
        '1y': [('max', '3mo', True)],
    }
    attempts = range_attempts.get(range_param, [('2y', '1d', False)])

    for ticker_code in _candidate_yahoo_tickers(code):
        for period, interval, agg_year in attempts:
            try:
                hist = yf.Ticker(ticker_code).history(
                    period=period, interval=interval, auto_adjust=False, actions=False
                )
                if hist.empty:
                    continue
                if agg_year:
                    hist = _hist_aggregate_to_yearly(hist)
                hist = _clip_hist_to_requested_range(hist, range_param, False)
                if hist.empty:
                    continue
                payload = _build_chart_payload_from_hist(hist, False)
                if not payload:
                    continue
                if range_param in ('1w', '1m', '1y'):
                    _merge_daily_ma_into_chart_payload_yf(payload, ticker_code)
                payload['code'] = code
                payload['requested_range'] = range_param
                return jsonify(payload)
            except Exception:
                continue

    return jsonify({'success': False, 'message': '차트 데이터를 불러올 수 없습니다.'}), 404


# 2단계 튜토리얼: 차트 봉 요약 기반 짧은 교육 멘트(GPT). 투자 조언 금지.
def serve_tutorial_chart_coach():
    """2단계 튜토리얼: 차트 봉 요약 기반 짧은 교육 멘트(GPT). 투자 조언 금지."""
    body = request.get_json(force=True, silent=True) or {}
    code = str(body.get('code') or '').strip()
    range_param = str(body.get('range') or '1d').strip().lower()
    stock_name = str(body.get('stock_name') or '').strip()
    if not code:
        return jsonify({'success': False, 'message': 'code가 필요합니다.'}), 400
    if range_param not in ('1d', '1w', '1m', '1y'):
        range_param = '1d'

    try:
        with current_app.test_client() as client:
            resp = client.get(
                f'/api/chart-data/{quote(code, safe="")}?range={quote(range_param, safe="")}'
            )
            payload = resp.get_json(silent=True) or {}
            status = resp.status_code
    except Exception as err:
        return jsonify({'success': False, 'message': f'차트 조회 실패: {err}'}), 200

    if status >= 400 or not payload.get('success') or not payload.get('candles'):
        msg = (payload.get('message') or '차트 데이터를 불러올 수 없습니다.').strip()
        return jsonify({'success': False, 'message': msg}), 200

    candles = payload['candles'][-40:]
    tail = candles[-10:]
    lines = []
    for c in tail:
        lines.append(
            'time=%s O=%s H=%s L=%s C=%s'
            % (c.get('time'), c.get('open'), c.get('high'), c.get('low'), c.get('close'))
        )
    blob = '\n'.join(lines)
    label = stock_name or code
    prompt = (
        '당신은 모의투자 앱의 차트 튜토리얼 도우미입니다.\n'
        '규칙: 투자 권유·매수·매도 조언 금지. 제공된 봉 숫자 요약만 근거로 말할 것.\n'
        '초보에게 한국어로 1~2문장만. "~처럼 읽을 수 있다"처럼 부드럽게.\n'
        '불확실하면 횡보·혼조 가능성을 언급.\n\n'
        f'종목: {label}, 차트 범위: {range_param}\n'
        f'최근 봉 요약:\n{blob}\n\n'
        '위만 보고 짧게 답하세요.'
    )

    result = call_gpt(prompt, model=DEFAULT_GPT_MODEL)
    if not result.get('success'):
        return jsonify({'success': False, 'message': result.get('message') or ''}), 200
    text = (result.get('text') or '').strip()
    if not text:
        return jsonify({'success': False, 'message': '응답이 비었습니다.'}), 200
    return jsonify({'success': True, 'text': text})


def _opening_price_for_mock(code, db_open=0):
    """모의투자 시가: KIS/실시간 캐시 open 우선, 없으면 DB 일봉 시가."""
    code = str(code or '').strip()
    try:
        odb = int(db_open or 0)
    except (TypeError, ValueError):
        odb = 0
    with _LIVE_PRICE_LOCK:
        live = _LIVE_PRICE_CACHE.get(code)
    if live and not live.get('loading'):
        lo = live.get('open')
        if lo is not None and str(lo) != '':
            try:
                io = int(float(lo))
                if io > 0:
                    return io
            except (TypeError, ValueError):
                pass
    if odb > 0:
        return odb
    return 0


# 모의투자용 시세 (실시간 캐시 우선).
def _effective_quote_for_mock(code, snap_fallback=None):
    """모의투자용 시세 (실시간 캐시 우선)."""
    code = str(code or '').strip()
    fb = snap_fallback if isinstance(snap_fallback, dict) else {}
    try:
        price = int(float(fb.get('price') or 0))
    except (TypeError, ValueError):
        price = 0
    rate = float(fb.get('rate') or 0.0)
    direction = str(fb.get('direction') or 'flat').lower()
    if direction not in ('up', 'down', 'flat'):
        direction = 'flat'
    with _LIVE_PRICE_LOCK:
        live = _LIVE_PRICE_CACHE.get(code)
    if live and not live.get('loading'):
        lp = live.get('price')
        if lp is not None and str(lp) != '':
            try:
                fp = float(lp)
            except (TypeError, ValueError):
                fp = 0.0
            if fp > 0:
                price = int(fp)
                rate = float(live.get('rate') or 0.0)
                direction = str(live.get('direction') or 'flat').lower()
                if direction not in ('up', 'down', 'flat'):
                    direction = 'flat'
    return price, rate, direction


# 한국 정규장(평일 09:00~15:30) 기준.
def _is_kr_regular_market_open_now():
    """한국 정규장(평일 09:00~15:30) 기준."""
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    hhmm = now.hour * 100 + now.minute
    return _KR_MARKET_OPEN_HHMM <= hhmm <= _KR_MARKET_CLOSE_HHMM


# `_live_fetch_enabled_now` — 모듈 내부 헬퍼.
def _live_fetch_enabled_now():
    if not _LIVE_BLOCK_OFFHOURS_FETCH:
        return True
    return _is_kr_regular_market_open_now()


# 정규장에서만 KIS 실시간 시세 호출(장외·주말은 TPS·정책 절약). yfinance·DB 동기화는 별도.
def _kis_fetch_allowed_now():
    """정규장에서만 KIS 실시간 시세 호출(장외·주말은 TPS·정책 절약). yfinance·DB 동기화는 별도."""
    return _live_fetch_enabled_now()


# `_candidate_yahoo_tickers` — 모듈 내부 헬퍼.
def _candidate_yahoo_tickers(code):
    if '.' in code:
        return [code]
    return [f'{code}.KS', f'{code}.KQ']


# `_to_int` — 모듈 내부 헬퍼.
def _to_int(value):
    try:
        return int((value or '').replace(',', '').strip())
    except ValueError:
        return 0


# `_to_float` — 모듈 내부 헬퍼.
def _to_float(value):
    try:
        return float((value or '').replace(',', '').strip())
    except ValueError:
        return 0.0


# `_chart_base_code` — 모듈 내부 헬퍼.
def _chart_base_code(code: str) -> str:
    return str(code or '').strip().split('.')[0].strip()


# KIS 기간별시세 차트는 실전 도메인이 표준(모의 키로 read-only 호출 시도).
def _kis_chart_base_url() -> str:
    """KIS 기간별시세 차트는 실전 도메인이 표준(모의 키로 read-only 호출 시도)."""
    return 'https://openapi.koreainvestment.com:9443'


# `_kis_tr_daily_chart` — 모듈 내부 헬퍼.
def _kis_tr_daily_chart() -> str:
    return 'FHKST03010100'


# `_kis_chart_get_json` — 모듈 내부 헬퍼.
def _kis_chart_get_json(token: str, tr_id: str, url: str, params: dict):
    try:
        res = requests.get(
            url,
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': f'Bearer {token}',
                'appkey': _KIS_KEY,
                'appsecret': _KIS_SECRET,
                'tr_id': tr_id,
                'custtype': 'P',
            },
            params=params,
            timeout=12,
        )
        if res.status_code != 200:
            return None
        body = res.json()
    except Exception:
        return None
    rt = body.get('rt_cd')
    if rt not in ('0', 0, None):
        return None
    return body


# `_kis_parse_daily_output2_row` — 모듈 내부 헬퍼.
def _kis_parse_daily_output2_row(row: dict) -> dict | None:
    if not isinstance(row, dict):
        return None
    d_raw = row.get('stck_bsop_date') or row.get('stck_bsop_dt') or row.get('date')
    if d_raw is None:
        return None
    ds = str(d_raw).strip().replace('-', '')
    if len(ds) == 8:
        date_str = f'{ds[:4]}-{ds[4:6]}-{ds[6:8]}'
    else:
        return None
    o = _to_int(row.get('stck_oprc') or row.get('oprc') or 0)
    h = _to_int(row.get('stck_hgpr') or row.get('hgpr') or 0)
    l = _to_int(row.get('stck_lwpr') or row.get('lwpr') or 0)
    c = _to_int(row.get('stck_clpr') or row.get('clpr') or row.get('stck_prpr') or 0)
    v = _to_int(row.get('acml_vol') or row.get('cntg_vol') or row.get('vol') or 0)
    if c <= 0:
        return None
    if o <= 0:
        o = c
    if h <= 0:
        h = c
    if l <= 0:
        l = c
    return {'date': date_str, 'open': float(o), 'high': float(h), 'low': float(l), 'close': float(c), 'volume': max(0, v)}


# 기간별 시세 한 구간 (KIS 최대 약 100봉). period_code: D|W|M|Y.
def _kis_fetch_daily_chunk(token: str, code: str, d_start: date, d_end: date, period_code: str = 'D') -> list[dict]:
    """기간별 시세 한 구간 (KIS 최대 약 100봉). period_code: D|W|M|Y."""
    base = _chart_base_code(code)
    if not base:
        return []
    url = f'{_kis_chart_base_url()}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice'
    params = {
        'fid_cond_mrkt_div_code': 'J',
        'fid_input_iscd': base,
        'fid_input_date_1': d_start.strftime('%Y%m%d'),
        'fid_input_date_2': d_end.strftime('%Y%m%d'),
        'fid_period_div_code': period_code,
        'fid_org_adj_prc': '0',
    }
    body = _kis_chart_get_json(token, _kis_tr_daily_chart(), url, params)
    if not body:
        return []
    raw = body.get('output2')
    if not isinstance(raw, list) or not raw:
        params_sw = {
            **params,
            'fid_input_date_1': d_end.strftime('%Y%m%d'),
            'fid_input_date_2': d_start.strftime('%Y%m%d'),
        }
        body2 = _kis_chart_get_json(token, _kis_tr_daily_chart(), url, params_sw)
        raw = (body2 or {}).get('output2') if body2 else None
    if not isinstance(raw, list) or not raw:
        return []
    out = []
    for row in raw:
        parsed = _kis_parse_daily_output2_row(row)
        if parsed:
            out.append(parsed)
    return out


# KIS 기간별 시세(D/W/M/Y)를 거슬러 올라가며 병합. 목표 봉 수까지 페이지.
def _kis_fetch_daily_chart(token: str, code: str, period_code: str) -> list[dict]:
    """KIS 기간별 시세(D/W/M/Y)를 거슬러 올라가며 병합. 목표 봉 수까지 페이지."""
    merged: dict[str, dict] = {}
    end_d = date.today()
    target = _CHART_TARGET_BARS.get(period_code, 500)
    win_days = _CHART_WINDOW_CAL_DAYS.get(period_code, 100)
    guard = 0
    while guard < 20 and len(merged) < target:
        guard += 1
        start_d = end_d - timedelta(days=win_days)
        chunk = _kis_fetch_daily_chunk(token, code, start_d, end_d, period_code)
        if not chunk:
            if guard == 1:
                chunk = _kis_fetch_daily_chunk(token, code, date(1990, 1, 1), end_d, period_code)
            if not chunk:
                break
        before = len(merged)
        for r in chunk:
            merged[r['date']] = r
        if len(merged) == before:
            break
        try:
            oldest = min(datetime.strptime(r['date'], '%Y-%m-%d').date() for r in chunk)
        except Exception:
            break
        if oldest >= end_d:
            break
        end_d = oldest - timedelta(days=1)
        if len(merged) >= target:
            break
    rows = sorted(merged.values(), key=lambda x: x['date'])
    if len(rows) > target:
        rows = rows[-target:]
    return rows


# `_chart_resolve_stock_id` — 모듈 내부 헬퍼.
def _chart_resolve_stock_id(code: str) -> int | None:
    base = _chart_base_code(code)
    if not base:
        return None
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT stock_id FROM stocks WHERE symbol = %s LIMIT 1', (base,))
            row = cur.fetchone()
            return int(row['stock_id']) if row and row.get('stock_id') else None
    except Exception:
        return None
    finally:
        if conn:
            conn.close()


def _enrich_quote_ohlc_from_daily_db(code: str, quote: dict) -> None:
    """open/high/low가 비었거나 0이면 stock_price_daily 최신 일봉으로 채운다."""
    if not quote or not isinstance(quote, dict):
        return

    def _int_or_zero(key):
        v = quote.get(key)
        try:
            return int(v) if v is not None else 0
        except (TypeError, ValueError):
            return 0

    if _int_or_zero('open') > 0 and _int_or_zero('high') > 0 and _int_or_zero('low') > 0:
        return

    stock_id = _chart_resolve_stock_id(code)
    if not stock_id:
        return
    conn = None
    row = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT open_price, high_price, low_price, close_price
                FROM stock_price_daily
                WHERE stock_id = %s
                ORDER BY date DESC
                LIMIT 1
                """,
                (stock_id,),
            )
            row = cur.fetchone()
    except Exception:
        return
    finally:
        if conn:
            conn.close()
    if not row:
        return

    for key, col in (('open', 'open_price'), ('high', 'high_price'), ('low', 'low_price')):
        if _int_or_zero(key) > 0:
            continue
        raw = row.get(col)
        if raw is None:
            continue
        try:
            iv = int(round(float(raw)))
            if iv > 0:
                quote[key] = iv
        except (TypeError, ValueError):
            pass


def _enrich_quote_previous_close_from_daily_db(code: str, quote: dict) -> None:
    """previous_close가 비었거나 0이면 stock_price_daily의 prev_close 또는 직전 일 종가로 채운다."""
    if not quote or not isinstance(quote, dict):
        return
    try:
        cur_pc = quote.get('previous_close')
        if cur_pc is not None and int(cur_pc) > 0:
            return
    except (TypeError, ValueError):
        pass

    stock_id = _chart_resolve_stock_id(code)
    if not stock_id:
        return
    conn = None
    prev_day = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT prev_close
                FROM stock_price_daily
                WHERE stock_id = %s
                ORDER BY date DESC
                LIMIT 1
                """,
                (stock_id,),
            )
            latest = cur.fetchone()
            if latest:
                pc = latest.get('prev_close')
                try:
                    pi = int(round(float(pc))) if pc is not None else 0
                except (TypeError, ValueError):
                    pi = 0
                if pi > 0:
                    quote['previous_close'] = pi
                    return
            cur.execute(
                """
                SELECT close_price
                FROM stock_price_daily
                WHERE stock_id = %s
                ORDER BY date DESC
                LIMIT 1 OFFSET 1
                """,
                (stock_id,),
            )
            prev_day = cur.fetchone()
    except Exception:
        return
    finally:
        if conn:
            conn.close()
    if not prev_day:
        return
    cp = prev_day.get('close_price')
    try:
        cpi = int(round(float(cp))) if cp is not None else 0
    except (TypeError, ValueError):
        cpi = 0
    if cpi > 0:
        quote['previous_close'] = cpi


def _rehydrate_quote_for_krx_display(code: str, quote: dict | None) -> None:
    """시세 카드용: OHLC·전일 종가·상하한가를 DB/KRX 규칙으로 idempotent 보강."""
    if not quote or not isinstance(quote, dict):
        return
    _enrich_quote_ohlc_from_daily_db(code, quote)
    _enrich_quote_previous_close_from_daily_db(code, quote)
    _enrich_quote_price_limits_krx(quote)


def _krx_tick_size(price: int) -> int:
    """거래소 호가 단위(원). 가격 구간별 단위 (일반적인 KRX 표)."""
    p = abs(int(price))
    if p < 1000:
        return 1
    if p < 5000:
        return 5
    if p < 10000:
        return 10
    if p < 50000:
        return 50
    if p < 100000:
        return 100
    if p < 500000:
        return 500
    if p < 1000000:
        return 1000
    if p < 5000000:
        return 5000
    return 10000


def _krx_upper_lower_from_prev_close(prev_close: int, limit_ratio: float = 0.30) -> tuple[int | None, int | None]:
    """전일 종가와 가격제한 비율로 상·하한가 근사(일반 주식 ±30% 가정). ETF·관리 등은 실제와 다를 수 있음."""
    if prev_close <= 0 or not math.isfinite(limit_ratio):
        return None, None
    raw_up = float(prev_close) * (1.0 + limit_ratio)
    raw_lo = float(prev_close) * (1.0 - limit_ratio)
    if raw_up <= float(prev_close) or raw_lo >= float(prev_close):
        return None, None
    tu = _krx_tick_size(int(raw_up))
    tl = _krx_tick_size(max(1, int(raw_lo)))
    upper = int(raw_up // tu) * tu
    lower = int((raw_lo + tl - 1) // tl) * tl
    if lower < tl:
        lower = tl
    if upper <= prev_close or lower >= prev_close or upper <= lower:
        return None, None
    return upper, lower


def _enrich_quote_price_limits_krx(quote: dict) -> None:
    """상·하한가가 비었을 때 국내 6자리 종목만 전일 종가·호가단위로 보강."""
    if not quote or not isinstance(quote, dict):
        return
    base = _chart_base_code(str(quote.get('code') or ''))
    if not base or not re.match(r'^\d{6}$', base):
        return

    def _missing_or_zero(key):
        v = quote.get(key)
        try:
            return v is None or int(v) <= 0
        except (TypeError, ValueError):
            return True

    if not _missing_or_zero('upper_limit') and not _missing_or_zero('lower_limit'):
        return

    prev = quote.get('previous_close')
    try:
        pi = int(prev) if prev is not None else 0
    except (TypeError, ValueError):
        pi = 0
    if pi <= 0:
        return

    upper, lower = _krx_upper_lower_from_prev_close(pi)
    if upper is not None and _missing_or_zero('upper_limit'):
        quote['upper_limit'] = upper
    if lower is not None and _missing_or_zero('lower_limit'):
        quote['lower_limit'] = lower


def _kis_int_first_positive(output, keys: tuple[str, ...]) -> int:
    if not output or not isinstance(output, dict):
        return 0
    for k in keys:
        v = _to_int(output.get(k))
        if v > 0:
            return v
    return 0


# `_chart_ensure_stock_id` — 모듈 내부 헬퍼.
def _chart_ensure_stock_id(code: str) -> int | None:
    sid = _chart_resolve_stock_id(code)
    if sid:
        return sid
    base = _chart_base_code(code)
    if not base:
        return None
    name = LIVE_PRICE_STOCKS.get(base) or PRICE_STOCKS.get(base) or base
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO stocks (symbol, name_ko, created_at, updated_at)
                VALUES (%s, %s, NOW(), NOW())
                ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
                """,
                (base, str(name)[:100]),
            )
            cur.execute('SELECT stock_id FROM stocks WHERE symbol = %s LIMIT 1', (base,))
            row = cur.fetchone()
            sid = int(row['stock_id']) if row and row.get('stock_id') else None
        conn.commit()
        return sid
    except Exception:
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()


# 최근 target_rows 개 일봉 (오름차순). _CHART_MIN_BARS['D'] 미만이면 None.
def _db_load_daily_candles(stock_id: int, target_rows: int) -> list[dict] | None:
    """최근 target_rows 개 일봉 (오름차순). _CHART_MIN_BARS['D'] 미만이면 None."""
    min_need = _CHART_MIN_BARS['D']
    lim = max(int(target_rows), min_need)
    conn = None
    rows = []
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT date, open_price, high_price, low_price, close_price, volume
                FROM stock_price_daily
                WHERE stock_id = %s
                ORDER BY date DESC
                LIMIT %s
                """,
                (stock_id, lim),
            )
            rows = list(reversed(cur.fetchall() or []))
    except Exception:
        return None
    finally:
        if conn:
            conn.close()
    out = []
    for row in rows:
        try:
            d = row.get('date')
            if hasattr(d, 'strftime'):
                ds = d.strftime('%Y-%m-%d')
            else:
                ds = str(d)[:10]
            o = row.get('open_price')
            h = row.get('high_price')
            l = row.get('low_price')
            c = row.get('close_price')
            v = row.get('volume') or 0
            if o is None or h is None or l is None or c is None:
                continue
            fv = float(c)
            if fv <= 0:
                continue
            out.append({
                'date': ds,
                'open': float(o),
                'high': float(h),
                'low': float(l),
                'close': fv,
                'volume': int(v or 0),
            })
        except Exception:
            continue
    if len(out) < min_need:
        return None
    return out


# `_upsert_daily_candles_to_db` — 모듈 내부 헬퍼.
def _upsert_daily_candles_to_db(stock_id: int, rows: list[dict]) -> None:
    if not stock_id or not rows:
        return
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            prev_close = None
            for r in sorted(rows, key=lambda x: x['date']):
                close_p = int(round(float(r['close'])))
                if close_p <= 0:
                    prev_close = None
                    continue
                open_p = int(round(float(r['open']))) or close_p
                high_p = int(round(float(r['high']))) or close_p
                low_p = int(round(float(r['low']))) or close_p
                volume = int(r.get('volume') or 0)
                cur.execute(
                    """
                    INSERT INTO stock_price_daily (
                        stock_id, date,
                        open_price, high_price, low_price,
                        close_price, prev_close, volume, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                        open_price  = COALESCE(NULLIF(VALUES(open_price), 0),  open_price),
                        high_price  = COALESCE(NULLIF(VALUES(high_price), 0),  high_price),
                        low_price   = COALESCE(NULLIF(VALUES(low_price), 0),   low_price),
                        close_price = COALESCE(NULLIF(VALUES(close_price), 0), close_price),
                        prev_close  = COALESCE(NULLIF(VALUES(prev_close), 0),  prev_close),
                        volume      = COALESCE(NULLIF(VALUES(volume), 0),      volume),
                        created_at  = NOW()
                    """,
                    (stock_id, r['date'], open_p, high_p, low_p, close_p, prev_close, volume),
                )
                prev_close = close_p
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


# `_daily_candles_to_chart_rows` — 모듈 내부 헬퍼.
def _daily_candles_to_chart_rows(candles: list[dict]) -> list[dict]:
    return [{'time': c['date'], 'open': c['open'], 'high': c['high'], 'low': c['low'], 'close': c['close']} for c in candles]


# 토스 스타일: range → D/W/M/Y 봉. D 는 DB 우선, 전 구간은 KIS 후 yfinance 폴백.
def _try_period_chart(code: str, range_param: str) -> dict | None:
    """토스 스타일: range → D/W/M/Y 봉. D 는 DB 우선, 전 구간은 KIS 후 yfinance 폴백."""
    pc = _CHART_PERIOD_MAP.get(range_param, 'D')
    if pc == 'D':
        stock_id = _chart_resolve_stock_id(code)
        daily = stock_id and _db_load_daily_candles(stock_id, _CHART_TARGET_BARS['D'])
        if daily:
            return _build_chart_payload_from_candles(_daily_candles_to_chart_rows(daily), False)
    token = _kis_get_token()
    if not token:
        return None
    rows = _kis_fetch_daily_chart(token, code, pc)
    min_need = _CHART_MIN_BARS.get(pc, 5)
    if not rows or len(rows) < min_need:
        return None
    if pc == 'D':
        sid = _chart_resolve_stock_id(code) or _chart_ensure_stock_id(code)
        if sid:
            _upsert_daily_candles_to_db(sid, rows)
    tgt = _CHART_TARGET_BARS.get(pc, 500)
    rows_sorted = sorted(rows, key=lambda x: x['date'])
    if len(rows_sorted) > tgt:
        rows_sorted = rows_sorted[-tgt:]
    payload = _build_chart_payload_from_candles(_daily_candles_to_chart_rows(rows_sorted), False)
    if payload and pc in ('W', 'M', 'Y'):
        _merge_daily_ma_into_chart_payload(payload, code, token)
    return payload


# `_normalize_percent` — 모듈 내부 헬퍼.
def _normalize_percent(value):
    if value in (None, '', 'N/A'):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if abs(num) <= 1:
        num *= 100
    return round(num, 2)


# `_safe_round` — 모듈 내부 헬퍼.
def _safe_round(value, digits=2):
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip().replace(',', '')
        if s in ('', '-', 'N/A', '—'):
            return None
        value = s
    elif value == '':
        return None
    if value == 'N/A':
        return None
    try:
        f = float(value)
        if not math.isfinite(f):
            return None
        return round(f, digits)
    except (TypeError, ValueError):
        return None


# `_valuation_ratio_displayable` — PER/PBR: None·NaN·0만 비어 있음으로 간주 (음수 PER은 유지).
def _valuation_ratio_displayable(value):
    if value is None:
        return None
    try:
        f = float(value)
        if not math.isfinite(f) or f == 0:
            return None
        return round(f, 2)
    except (TypeError, ValueError):
        return None


# `_format_period_label` — 모듈 내부 헬퍼.
def _format_period_label(value):
    if hasattr(value, 'strftime'):
        return value.strftime('%Y-%m')
    return str(value)


# `_extract_series_values` — 모듈 내부 헬퍼.
def _extract_series_values(df, candidates, limit=4):
    if df is None or getattr(df, 'empty', True):
        return None
    for candidate in candidates:
        if candidate in df.index:
            series = df.loc[candidate]
            values = []
            columns = list(df.columns)[:limit]
            for column in columns:
                raw = series.get(column)
                values.append(None if pd.isna(raw) else _safe_round(raw, 2))
            return values
    return None


# `_build_table_payload` — 모듈 내부 헬퍼.
def _build_table_payload(df, rows_config, limit=4):
    if df is None or getattr(df, 'empty', True):
        return {'columns': [], 'rows': []}

    columns = [_format_period_label(column) for column in list(df.columns)[:limit]]
    rows = []
    for label, candidates in rows_config:
        values = _extract_series_values(df, candidates, limit=limit)
        if values and any(value is not None for value in values):
            rows.append({'label': label, 'values': values})
    return {'columns': columns, 'rows': rows}


# `_get_last_non_zero_dividend` — 모듈 내부 헬퍼.
def _get_last_non_zero_dividend(actions):
    if actions is None or getattr(actions, 'empty', True) or 'Dividends' not in actions:
        return None, None, 0
    dividends = actions['Dividends'].dropna()
    dividends = dividends[dividends > 0]
    if dividends.empty:
        return None, None, 0
    latest_date = dividends.index[-1]
    latest_value = float(dividends.iloc[-1])
    return latest_value, latest_date.strftime('%Y-%m-%d'), int(dividends.count())


_HANGUL_IN_NEWS_RE = re.compile(r'[\uac00-\ud7a3]')


def _is_korean_news_article(title, summary=''):
    """국내 RSS·한글 제목 기사만 노출 (yfinance 영문 뉴스 제외용)."""
    return bool(_HANGUL_IN_NEWS_RE.search(f'{title or ""} {summary or ""}'))


def _news_row_to_detail_item(row):
    """news_articles 행 → 종목 상세 패널용 dict."""
    if isinstance(row, dict):
        d = row
    else:
        d = dict(row)
    title = str(d.get('title') or '').strip()
    summary = str(d.get('summary') or '').strip()
    if not _is_korean_news_article(title, summary):
        return None
    pa = d.get('published_at')
    if hasattr(pa, 'isoformat'):
        published_at = pa.isoformat()
    else:
        published_at = str(pa or '').strip()
    return {
        'title': title or '제목 없음',
        'summary': summary,
        'published_at': published_at,
        'source': str(d.get('source') or '').strip(),
        'url': str(d.get('url') or '').strip(),
    }


# `_build_domestic_news_items` — 종목 상세「관련 뉴스」(DB 국내 기사만).
def _build_domestic_news_items(code, name, limit=5):
    """
    news_stock_rel 우선, 부족하면 종목명·코드 LIKE 보완.
    yfinance 영문 뉴스는 사용하지 않는다.
    """
    sym = re.sub(r'\D', '', str(code or ''))
    if len(sym) != 6:
        sym = _resolve_stock_code_for_news(name)
    stock_name = str(name or '').strip()
    limit = max(1, min(int(limit or 5), 8))
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            rows = []
            if sym and len(sym) == 6:
                try:
                    cursor.execute(
                        """
                        SELECT n.title, n.summary, n.url, n.source, n.published_at
                        FROM news_stock_rel r
                        INNER JOIN stocks s ON s.stock_id = r.stock_id AND s.symbol = %s
                        INNER JOIN news_articles n ON n.news_id = r.news_id
                        ORDER BY n.published_at DESC, n.news_id DESC
                        LIMIT %s
                        """,
                        (sym, limit * 2),
                    )
                    rows = list(cursor.fetchall() or [])
                except Exception as exc:
                    err = getattr(exc, 'args', None)
                    if not (err and err[0] == 1146):
                        logging.getLogger(__name__).warning(
                            '[stock-detail] news_stock_rel skip: %s', exc,
                        )

            if len(rows) < limit and stock_name:
                seen_titles = {str(dict(r).get('title') or '').strip() for r in rows}
                try:
                    like = f'%{stock_name}%'
                    cursor.execute(
                        """
                        SELECT title, summary, url, source, published_at
                        FROM news_articles
                        WHERE title LIKE %s OR summary LIKE %s
                        ORDER BY published_at DESC, news_id DESC
                        LIMIT %s
                        """,
                        (like, like, limit * 3),
                    )
                    for r in cursor.fetchall() or []:
                        t = str(dict(r).get('title') or '').strip()
                        if not t or t in seen_titles:
                            continue
                        rows.append(r)
                        seen_titles.add(t)
                        if len(rows) >= limit * 2:
                            break
                except Exception as exc:
                    logging.getLogger(__name__).warning(
                        '[stock-detail] news name search skip: %s', exc,
                    )

            if len(rows) < limit and sym and len(sym) == 6:
                seen_titles = {str(dict(r).get('title') or '').strip() for r in rows}
                try:
                    like_code = f'%{sym}%'
                    cursor.execute(
                        """
                        SELECT title, summary, url, source, published_at
                        FROM news_articles
                        WHERE title LIKE %s OR summary LIKE %s
                        ORDER BY published_at DESC, news_id DESC
                        LIMIT %s
                        """,
                        (like_code, like_code, limit * 2),
                    )
                    for r in cursor.fetchall() or []:
                        t = str(dict(r).get('title') or '').strip()
                        if not t or t in seen_titles:
                            continue
                        rows.append(r)
                        seen_titles.add(t)
                        if len(rows) >= limit * 2:
                            break
                except Exception as exc:
                    logging.getLogger(__name__).warning(
                        '[stock-detail] news code search skip: %s', exc,
                    )

        items = []
        for row in rows:
            item = _news_row_to_detail_item(row)
            if item:
                items.append(item)
            if len(items) >= limit:
                break
        return items
    except Exception as exc:
        logging.getLogger(__name__).warning('[stock-detail] domestic news skip: %s', exc)
        return []
    finally:
        if conn:
            conn.close()


# KIS 주식현재가 투자자 (개인·외국인·기관 순매수 거래대금).
def _kis_fetch_investor_flow(token, code):
    """inquire-investor (FHKST01010900) — pykrx/KRX 미설정 시 폴백."""
    try:
        res = requests.get(
            f'{_KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor',
            headers={
                'Content-Type': 'application/json',
                'authorization': f'Bearer {token}',
                'appkey': _KIS_KEY,
                'appsecret': _KIS_SECRET,
                'tr_id': 'FHKST01010900',
            },
            params={'fid_cond_mrkt_div_code': 'J', 'fid_input_iscd': code},
            timeout=12,
        )
    except Exception as e:
        return None, str(e)

    try:
        body = res.json()
    except ValueError:
        return None, f'HTTP {res.status_code}'

    if res.status_code != 200:
        err = body.get('msg1') or body.get('message') or f'HTTP {res.status_code}'
        return None, err

    if body.get('rt_cd') not in ('0', 0, None):
        return None, body.get('msg1') or body.get('msg_cd') or 'KIS 조회 실패'

    raw_out = body.get('output')
    if isinstance(raw_out, dict):
        rows = [raw_out]
    elif isinstance(raw_out, list):
        rows = [r for r in raw_out if isinstance(r, dict)]
    else:
        return None, '투자자 동향 응답 없음'

    if not rows:
        return None, '투자자 동향 응답 없음'

    rows.sort(key=lambda r: str(r.get('stck_bsop_date') or ''), reverse=True)
    latest = rows[0]
    date_raw = str(latest.get('stck_bsop_date') or '').strip()
    if len(date_raw) == 8 and date_raw.isdigit():
        updated_at = f'{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}'
    else:
        updated_at = date_raw or ''

    field_map = (
        ('개인', 'prsn_ntby_tr_pbmn', 'prsn_ntby_qty'),
        ('외국인', 'frgn_ntby_tr_pbmn', 'frgn_ntby_qty'),
        ('기관', 'orgn_ntby_tr_pbmn', 'orgn_ntby_qty'),
    )
    items = []
    for label, pbmn_key, qty_key in field_map:
        value = None
        for key in (pbmn_key, qty_key):
            if key in latest and latest.get(key) not in (None, ''):
                value = _to_int(latest.get(key))
                break
        items.append({'label': label, 'value': value})

    if not any(item.get('value') is not None for item in items):
        return None, '투자자 동향 필드 없음'

    return {
        'available': True,
        'source': 'KIS',
        'updated_at': updated_at,
        'items': items,
    }, None


def _build_investor_flow_from_pykrx(code):
    """pykrx 거래대금 기준 투자자 동향 (KRX_ID/KRX_PW 필요할 수 있음)."""
    if pykrx_stock is None:
        return None, 'pykrx 미설치'

    end = datetime.now().strftime('%Y%m%d')
    start = (datetime.now() - timedelta(days=10)).strftime('%Y%m%d')
    try:
        df = pykrx_stock.get_market_trading_value_by_date(start, end, code)
    except Exception as exc:
        return None, str(exc)[:120]

    if df is None or getattr(df, 'empty', True):
        krx_hint = ''
        if not (os.getenv('KRX_ID') or '').strip():
            krx_hint = ' (KRX_ID·KRX_PW 미설정)'
        return None, f'pykrx 데이터 없음{krx_hint}'

    latest = df.iloc[-1]
    index_map = {
        '개인': ['개인', '개인투자자'],
        '외국인': ['외국인합계', '외국인'],
        '기관': ['기관합계', '기관'],
    }
    items = []
    for label, candidates in index_map.items():
        value = None
        for candidate in candidates:
            if candidate in latest.index:
                raw = latest.get(candidate)
                value = None if pd.isna(raw) else int(raw)
                break
        items.append({'label': label, 'value': value})

    if not any(item['value'] is not None for item in items):
        return None, 'pykrx 컬럼 없음'

    return {
        'available': True,
        'source': 'pykrx',
        'updated_at': _format_period_label(df.index[-1]),
        'items': items,
    }, None


_INVESTOR_FLOW_FAIL_CACHE_TTL = 20.0


def _kis_fetch_investor_flow_with_retry(token, code, *, attempts=3):
    """KIS 초당 호출 제한(EGW00201) 시 짧게 재시도."""
    last_err = ''
    for attempt in range(max(1, attempts)):
        kis_data, kis_err = _kis_fetch_investor_flow(token, code)
        if kis_data:
            return kis_data, None
        last_err = kis_err or ''
        if '초과' not in str(last_err) and 'EGW00201' not in str(last_err):
            break
        if attempt + 1 < attempts:
            time.sleep(0.4 * (attempt + 1))
    return None, last_err


# `_build_investor_flow_payload` — 모듈 내부 헬퍼.
def _build_investor_flow_payload(code, kis_token=None):
    cached = _INVESTOR_FLOW_CACHE.get(code)
    if cached:
        age = time.time() - cached['ts']
        ttl = _INVESTOR_FLOW_CACHE_TTL if cached['data'].get('available') else _INVESTOR_FLOW_FAIL_CACHE_TTL
        if age < ttl:
            return cached['data']

    data = None
    py_err = ''
    kis_err = ''

    if _KIS_KEY and _KIS_SECRET:
        token = kis_token or _kis_get_token()
        if token:
            kis_data, kis_err = _kis_fetch_investor_flow_with_retry(token, code)
            if kis_data:
                data = kis_data
        else:
            kis_err = 'KIS 인증 실패'

    if not data:
        built, py_err = _build_investor_flow_from_pykrx(code)
        if built:
            data = built

    if not data:
        data = {'available': False, 'source': '', 'updated_at': '', 'items': []}

    _INVESTOR_FLOW_CACHE[code] = {'ts': time.time(), 'data': data}
    return data


# `_get_cached_peer_info` — 모듈 내부 헬퍼.
def _get_cached_peer_info(code):
    cached = _BASIC_PEER_CACHE.get(code)
    if cached and (time.time() - cached['ts'] < _BASIC_PEER_CACHE_TTL):
        return cached['data']

    data = None
    for ticker_code in _candidate_yahoo_tickers(code):
        try:
            info = yf.Ticker(ticker_code).info
        except Exception:
            continue
        if info:
            data = {
                'sector': info.get('sector') or '',
                'industry': info.get('industry') or '',
                'per': _safe_round(info.get('trailingPE')),
                'pbr': _safe_round(info.get('priceToBook')),
                'psr': _safe_round(info.get('priceToSalesTrailing12Months')),
            }
            break

    if data is None:
        data = {'sector': '', 'industry': '', 'per': None, 'pbr': None, 'psr': None}

    _BASIC_PEER_CACHE[code] = {'ts': time.time(), 'data': data}
    return data


# `_build_valuation_comparison` — 모듈 내부 헬퍼.
# 동종 업종 평균(industry_avg)은 yfinance 피어 표본. KIS 업종·시장 배수 TR은 미연동(추후 스펙 확정 시).
def _build_valuation_comparison(code, target_metrics):
    target_info = _get_cached_peer_info(code)
    target_sector = target_info.get('sector')
    target_industry = target_info.get('industry')
    peer_pool = []

    for peer_code in list(PRICE_STOCKS.keys())[:40]:
        if peer_code == code:
            continue
        peer_info = _get_cached_peer_info(peer_code)
        same_group = False
        if target_industry and peer_info.get('industry') == target_industry:
            same_group = True
        elif target_sector and peer_info.get('sector') == target_sector:
            same_group = True
        if same_group:
            peer_pool.append(peer_info)
        if len(peer_pool) >= 8:
            break

    def _avg(metric_name):
        values = [peer.get(metric_name) for peer in peer_pool if peer.get(metric_name) is not None]
        if not values:
            return None
        return round(sum(values) / len(values), 2)

    rows = []
    for label, key in (('PER', 'per'), ('PBR', 'pbr'), ('PSR', 'psr')):
        value = target_metrics.get(key)
        avg = _avg(key)
        gap = round(value - avg, 2) if value is not None and avg is not None else None
        rows.append({'label': label, 'value': value, 'industry_avg': avg, 'gap': gap})

    return {
        'basis': target_industry or target_sector or '비교군 부족',
        'peer_count': len(peer_pool),
        'rows': rows,
    }


def _kis_output_psr_optional(output):
    """KIS inquire-price output에서 PSR에 해당할 수 있는 필드. 문서·버전별 키가 다를 수 있음."""
    if not output or not isinstance(output, dict):
        return None
    for key in ('psr', 'hts_psr', 'hts_pb_psr', 'stck_psr'):
        raw = output.get(key)
        if raw is None or raw == '' or raw == '-':
            continue
        v = _safe_round(raw)
        if v is not None:
            return v
    return None


def _kis_output_bps_optional(output):
    """KIS inquire-price output에서 BPS 후보 필드. 문서·버전별 키가 다를 수 있음."""
    if not output or not isinstance(output, dict):
        return None
    for key in ('bps', 'stck_bps', 'stck_bass_prc', 'hts_bps', 'book_value_per_share'):
        raw = output.get(key)
        if raw is None or raw == '' or raw == '-':
            continue
        v = _safe_round(raw)
        if v is not None and v > 0:
            return v
    return None


def _kis_output_pbr_optional(output):
    """KIS inquire-price output에서 PBR 직접 표기 필드 후보."""
    if not output or not isinstance(output, dict):
        return None
    for key in ('pbr', 'stck_pbr', 'hts_pbr', 'hts_spbr', 'stck_pbmn', 'pbr_r'):
        raw = output.get(key)
        if raw is None or raw == '' or raw == '-':
            continue
        v = _safe_round(raw)
        if v is not None and v > 0:
            return v
    return None


# `_build_stock_payload` — 모듈 내부 헬퍼.
def _build_stock_payload(code, name, output):
    sign = output.get('prdy_vrss_sign', '3')  # 1:상한 2:상승 3:보합 4:하한 5:하락
    direction = 'up' if sign in ('1', '2') else 'down' if sign in ('4', '5') else 'flat'
    change_abs = _to_int(output.get('prdy_vrss'))
    change_signed = change_abs if direction == 'up' else -change_abs
    rate_abs = _to_float(output.get('prdy_ctrt'))
    rate_signed = rate_abs if direction == 'up' else -rate_abs

    pl = {
        'code': code,
        'name': name,
        'price': _to_int(output.get('stck_prpr')),
        'change': change_signed,
        'rate': rate_signed,
        'volume': _to_int(output.get('acml_vol')),
        'open': _to_int(output.get('stck_oprc')),
        'previous_close': _to_int(output.get('stck_sdpr') or output.get('stck_prdy_clpr')),
        'high': _to_int(output.get('stck_hgpr')),
        'low': _to_int(output.get('stck_lwpr')),
        'upper_limit': _kis_int_first_positive(
            output, ('stck_mxpr', 'mxpr', 'hts_mxpr', 'stck_uplm_prpr')
        ),
        'lower_limit': _kis_int_first_positive(
            output, ('stck_llam', 'llam', 'hts_llam', 'stck_lwlm', 'stck_lwlm_prpr')
        ),
        'traded_value': _to_int(output.get('acml_tr_pbmn')),
        'per': _safe_round(output.get('per')),
        'pbr': _safe_round(output.get('pbr')) or _kis_output_pbr_optional(output),
        'roe': None,
        'psr': _kis_output_psr_optional(output),
        'foreign_ownership_rate': _normalize_percent(output.get('frgn_hldn_rt')),
        'direction': direction,
        'stale': False,
        'error': None,
    }
    _enrich_quote_price_limits_krx(pl)
    return pl


# `_build_yfinance_payload` — 모듈 내부 헬퍼.
def _build_yfinance_payload(code, name, history):
    closes = history['Close'].dropna()
    if closes.empty:
        raise ValueError('종가 데이터 없음')

    current_price = int(round(float(closes.iloc[-1])))
    previous_price = current_price
    if len(closes) >= 2:
        previous_price = int(round(float(closes.iloc[-2])))

    diff = current_price - previous_price
    if diff > 0:
        direction = 'up'
    elif diff < 0:
        direction = 'down'
    else:
        direction = 'flat'

    rate = (diff / previous_price * 100) if previous_price else 0.0
    volume_series = history['Volume'].dropna() if 'Volume' in history else pd.Series(dtype='float64')
    volume = int(round(float(volume_series.iloc[-1]))) if not volume_series.empty else 0

    pl = {
        'code': code,
        'name': name,
        'price': current_price,
        'change': diff,
        'rate': rate,
        'volume': volume,
        'open': int(round(float(history['Open'].iloc[-1]))) if 'Open' in history else 0,
        'previous_close': previous_price,
        'high': int(round(float(history['High'].iloc[-1]))) if 'High' in history else 0,
        'low': int(round(float(history['Low'].iloc[-1]))) if 'Low' in history else 0,
        'upper_limit': None,
        'lower_limit': None,
        'traded_value': int(round(current_price * volume)),
        'per': None,
        'pbr': None,
        'roe': None,
        'psr': None,
        'foreign_ownership_rate': None,
        'direction': direction,
        'stale': True,
        'error': None,
    }
    _enrich_quote_price_limits_krx(pl)
    return pl


# pykrx 일봉 폴백 시세.
def _fetch_pykrx_quote(code, name):
    """pykrx 일봉 폴백 시세."""
    if not pykrx_stock:
        return None, 'pykrx 미사용'
    try:
        from datetime import datetime, timedelta

        end = datetime.now().date()
        start = end - timedelta(days=14)
        df = pykrx_stock.get_market_ohlcv(
            start.strftime('%Y%m%d'),
            end.strftime('%Y%m%d'),
            code,
            adjusted=False,
        )
        if df is None or getattr(df, 'empty', True):
            return None, 'pykrx 빈 데이터'
        rename_map = {'시가': 'Open', '고가': 'High', '저가': 'Low', '종가': 'Close', '거래량': 'Volume'}
        df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
        if 'Close' not in df.columns:
            return None, 'pykrx 종가 없음'
        return _build_yfinance_payload(code, name, df), None
    except Exception as e:
        return None, str(e)


# `_fetch_yfinance_quote` — 모듈 내부 헬퍼.
def _fetch_yfinance_quote(code, name):
    last_error = 'yfinance 조회 실패'
    for ticker in _candidate_yahoo_tickers(code):
        try:
            history = yf.Ticker(ticker).history(period='5d', interval='1d', auto_adjust=False)
        except Exception as e:
            last_error = str(e)
            continue

        if history is None or history.empty:
            last_error = f'{ticker} 데이터 없음'
            continue

        try:
            return _build_yfinance_payload(code, name, history), None
        except Exception as e:
            last_error = str(e)

    py_payload, py_err = _fetch_pykrx_quote(code, name)
    if py_payload is not None:
        return py_payload, None
    if py_err:
        last_error = f'{last_error}; pykrx: {py_err}'
    return None, last_error


# `_fetch_quote_snapshot` — 모듈 내부 헬퍼.
def _fetch_quote_snapshot(code, name, token):
    payload = None
    output = None
    err = None

    if token and _KIS_KEY and _KIS_SECRET:
        for tr_id in (_KIS_TR, _KIS_TR_FB):
            output, err = _kis_fetch_one(token, code, tr_id)
            if output is not None:
                payload = _build_stock_payload(code, name, output)
                break

    if payload is None:
        payload, yf_err = _fetch_yfinance_quote(code, name)
        if payload is None:
            err = yf_err or err

    return payload, output, err


# `_yf_parallel_stock_fundamentals` — 모듈 내부 헬퍼.
def _yf_parallel_stock_fundamentals(ticker, timeout_sec=18.0):
    """단일 yfinance Ticker에 대해 info·분기/연간 재무 시트를 병렬 로드한다."""
    if ticker is None:
        return {}, pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

    def _load_info():
        try:
            out = ticker.info or {}
            return out if isinstance(out, dict) else {}
        except Exception:
            return {}

    def _load_qf():
        try:
            return ticker.quarterly_financials
        except Exception:
            return pd.DataFrame()

    def _load_qbs():
        try:
            return ticker.quarterly_balance_sheet
        except Exception:
            return pd.DataFrame()

    def _load_abs():
        try:
            return ticker.balance_sheet
        except Exception:
            return pd.DataFrame()

    with ThreadPoolExecutor(max_workers=4) as ex:
        f_info = ex.submit(_load_info)
        f_qf = ex.submit(_load_qf)
        f_qbs = ex.submit(_load_qbs)
        f_abs = ex.submit(_load_abs)
        futures = (f_info, f_qf, f_qbs, f_abs)
        done_set, pending = wait(futures, timeout=timeout_sec)
        for p in pending:
            try:
                p.cancel()
            except Exception:
                pass

        def _result_or(fut, default):
            if fut not in done_set:
                return default
            try:
                return fut.result(timeout=0)
            except Exception:
                return default

        info = _result_or(f_info, {})
        if not isinstance(info, dict):
            info = {}
        qf = _result_or(f_qf, pd.DataFrame())
        if not isinstance(qf, pd.DataFrame):
            qf = pd.DataFrame()
        qbs = _result_or(f_qbs, pd.DataFrame())
        if not isinstance(qbs, pd.DataFrame):
            qbs = pd.DataFrame()
        abs_df = _result_or(f_abs, pd.DataFrame())
        if not isinstance(abs_df, pd.DataFrame):
            abs_df = pd.DataFrame()
    return info, qf, qbs, abs_df


# `_yf_info_price` — 모듈 내부 헬퍼 (PER/PBR 보강용 시가).
def _yf_info_price(info):
    if not isinstance(info, dict):
        return None
    for key in ('regularMarketPrice', 'currentPrice', 'previousClose', 'open', 'postMarketPrice'):
        v = info.get(key)
        if v is None:
            continue
        try:
            f = float(v)
            if f > 0:
                return f
        except (TypeError, ValueError):
            continue
    return None


# `_yf_info_quality_score` — yfinance info 품질(티커 후보 .KS/.KQ 선택용).
def _yf_info_quality_score(info):
    if not isinstance(info, dict) or not info:
        return 0
    score = len(info)
    if _yf_info_price(info):
        score += 40
    for k in ('trailingPE', 'forwardPE', 'priceToBook', 'trailingEps', 'bookValue', 'epsTrailingTwelveMonths'):
        v = info.get(k)
        if v is not None and v != '' and v != '-':
            score += 5
    return score


# `_yf_stock_detail_pick_best` — 6자리 종목은 .KS·.KQ 중 info가 나은 쪽을 고른다.
def _yf_stock_detail_pick_best(code, timeout_sec=18.0):
    best_ticker = None
    best_inf = {}
    best_qf = pd.DataFrame()
    best_qbs = pd.DataFrame()
    best_abs = pd.DataFrame()
    best_score = -1
    code_str = str(code or '')
    for ticker_code in _candidate_yahoo_tickers(code):
        try:
            t = yf.Ticker(ticker_code)
            inf, qf, qbs, abs_df = _yf_parallel_stock_fundamentals(t, timeout_sec=timeout_sec)
        except Exception:
            continue
        sc = _yf_info_quality_score(inf)
        if sc > best_score:
            best_score = sc
            best_ticker = t
            best_inf, best_qf, best_qbs, best_abs = inf, qf, qbs, abs_df
        if '.' in code_str or sc >= 100:
            break
    return best_ticker, best_inf, best_qf, best_qbs, best_abs


# `_fill_per_pbr_from_kis_and_info` — 모듈 내부 헬퍼.
def _fill_per_pbr_from_kis_and_info(quote, kis_output, info, per, pbr):
    """PER/PBR가 비었을 때 KIS eps·bps 및 yfinance로 보강 (KIS EPS/BPS는 스키마와 동일 단위·참고 배수)."""
    px_kis = None
    if isinstance(kis_output, dict):
        pi = _to_int(kis_output.get('stck_prpr'))
        if pi and pi > 0:
            px_kis = float(pi)
    qpx = None
    qp = quote.get('price')
    if qp is not None:
        try:
            qpx = float(qp)
        except (TypeError, ValueError):
            qpx = None
    if qpx is None or qpx <= 0:
        qpx = px_kis

    if per is None and isinstance(kis_output, dict):
        eps = _safe_round(kis_output.get('eps'))
        if qpx and eps and eps > 0:
            per = _safe_round(qpx / eps)
    if pbr is None and isinstance(kis_output, dict):
        direct_pbr = _kis_output_pbr_optional(kis_output)
        if direct_pbr is not None:
            pbr = _safe_round(direct_pbr)
    if pbr is None and isinstance(kis_output, dict):
        bps = _kis_output_bps_optional(kis_output)
        if qpx and bps and bps > 0:
            pbr = _safe_round(qpx / bps)

    ypx = _yf_info_price(info)
    if ypx is None or ypx <= 0:
        ypx = qpx

    if per is None and isinstance(info, dict):
        teps = None
        for eps_key in ('trailingEps', 'epsTrailingTwelveMonths', 'forwardEps'):
            cand = _safe_round(info.get(eps_key))
            if cand is not None and cand > 0:
                teps = cand
                break
        if ypx and teps and teps > 0:
            per = _safe_round(ypx / teps)
        if per is None:
            per = _safe_round(info.get('forwardPE'))
    if pbr is None and isinstance(info, dict):
        bv = _safe_round(info.get('bookValue'))
        if ypx and bv and bv > 0:
            pbr = _safe_round(ypx / bv)
    if pbr is None and isinstance(info, dict):
        sh = None
        for sk in ('sharesOutstanding', 'impliedSharesOutstanding'):
            raw = info.get(sk)
            if raw is None:
                continue
            try:
                sf = float(raw)
                if math.isfinite(sf) and sf > 0:
                    sh = sf
                    break
            except (TypeError, ValueError):
                continue
        eq = None
        for ek in ('totalStockholderEquity', 'commonStockTotalEquity', 'totalCommonStockholdersEquity'):
            raw = info.get(ek)
            if raw is None:
                continue
            try:
                ef = float(raw)
                if math.isfinite(ef) and ef > 0:
                    eq = ef
                    break
            except (TypeError, ValueError):
                continue
        if ypx and sh and eq and sh > 0 and eq > 0:
            bvp = eq / sh
            if bvp > 0:
                pbr = _safe_round(ypx / bvp)

    return per, pbr


def _pbr_from_equity_shares_price(equity, shares, price):
    """자본총계·유통주식수·주가로 PBR 근사."""
    try:
        eq = float(equity)
        sh = float(shares)
        px = float(price)
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(eq) and math.isfinite(sh) and math.isfinite(px)):
        return None
    if eq <= 0 or sh <= 0 or px <= 0:
        return None
    bvp = eq / sh
    if bvp <= 0:
        return None
    return _safe_round(px / bvp)


def _try_pbr_from_balance_sheets(info, quote, annual_bs, quarterly_bs, pbr):
    """yfinance info/재무제표로 PBR 보강 (bookValue·BPS가 비었을 때)."""
    if pbr is not None:
        return pbr
    qpx = None
    qp = quote.get('price')
    if qp is not None:
        try:
            qpx = float(qp)
        except (TypeError, ValueError):
            qpx = None
    if (qpx is None or qpx <= 0) and isinstance(info, dict):
        yp = _yf_info_price(info)
        if yp and yp > 0:
            qpx = float(yp)
    if qpx is None or qpx <= 0:
        return None

    sh = None
    if isinstance(info, dict):
        for sk in ('sharesOutstanding', 'impliedSharesOutstanding'):
            raw = info.get(sk)
            if raw is None:
                continue
            try:
                sf = float(raw)
                if math.isfinite(sf) and sf > 0:
                    sh = sf
                    break
            except (TypeError, ValueError):
                continue
    if sh is None and isinstance(info, dict):
        try:
            mcap = float(info.get('marketCap') or 0)
            if mcap > 0 and qpx > 0:
                sh = mcap / qpx
        except (TypeError, ValueError):
            pass
    if sh is None or sh <= 0:
        return None

    equity_keys = [
        'Stockholders Equity',
        'Common Stock Equity',
        'Total Equity Gross Minority Interest',
    ]
    for df in (annual_bs, quarterly_bs):
        vals = _extract_series_values(df, equity_keys, limit=1)
        if not vals or vals[0] is None:
            continue
        got = _pbr_from_equity_shares_price(vals[0], sh, qpx)
        if got is not None:
            return got
    return None


# `_build_stock_detail_payload` — 모듈 내부 헬퍼.
def _build_stock_detail_payload(code, name, token):
    # 다른 KIS 시세 호출 전에 투자자 동향을 먼저 조회 (호출 한도·순서 이슈 방지)
    investor_flows = _build_investor_flow_payload(code, kis_token=token)
    quote, kis_output, err = _fetch_quote_snapshot(code, name, token)
    if quote is None:
        raise ValueError(err or '상세 시세 조회 실패')
    _rehydrate_quote_for_krx_display(code, quote)

    ticker = None
    info = {}
    quarterly_financials = pd.DataFrame()
    quarterly_balance_sheet = pd.DataFrame()
    annual_balance_sheet = pd.DataFrame()
    try:
        ticker, info, quarterly_financials, quarterly_balance_sheet, annual_balance_sheet = (
            _yf_stock_detail_pick_best(code, timeout_sec=18.0)
        )
    except Exception:
        ticker = None
        info = {}

    market_cap = _safe_round(info.get('marketCap'), 0)
    if market_cap is None and kis_output:
        market_cap = _safe_round(kis_output.get('hts_avls'), 0)
    dividend_yield = _normalize_percent(info.get('dividendYield'))
    if dividend_yield is None:
        dividend_yield = _normalize_percent(kis_output.get('divi') if kis_output else None)

    per = _valuation_ratio_displayable(quote.get('per')) or _valuation_ratio_displayable(
        _safe_round(info.get('trailingPE'))
    )
    pbr = _valuation_ratio_displayable(quote.get('pbr')) or _valuation_ratio_displayable(
        _safe_round(info.get('priceToBook'))
    )
    per, pbr = _fill_per_pbr_from_kis_and_info(quote, kis_output, info, per, pbr)
    roe = _normalize_percent(info.get('returnOnEquity'))
    psr = quote.get('psr') if quote.get('psr') is not None else _safe_round(info.get('priceToSalesTrailing12Months'))
    foreign_rate = quote.get('foreign_ownership_rate')
    if foreign_rate is None:
        foreign_rate = _normalize_percent(info.get('heldPercentInstitutions'))

    actions = ticker.actions if ticker is not None else pd.DataFrame()
    last_dividend, last_dividend_date, dividend_count = _get_last_non_zero_dividend(actions)

    performance = _build_table_payload(
        quarterly_financials,
        [
            ('매출', ['Total Revenue', 'Operating Revenue', 'Revenue']),
            ('영업이익', ['Operating Income', 'EBIT']),
            ('순이익', ['Net Income', 'Net Income Common Stockholders', 'Net Income Including Noncontrolling Interests']),
            ('EPS', ['Diluted EPS', 'Basic EPS']),
        ],
    )

    statements = _build_table_payload(
        annual_balance_sheet,
        [
            ('총자산', ['Total Assets']),
            ('총부채', ['Total Liabilities Net Minority Interest', 'Total Liabilities']),
            ('자본총계', ['Stockholders Equity', 'Common Stock Equity', 'Total Equity Gross Minority Interest']),
            ('현금성자산', ['Cash And Cash Equivalents', 'Cash Cash Equivalents And Short Term Investments']),
        ],
    )

    total_liabilities = _extract_series_values(quarterly_balance_sheet, ['Total Liabilities Net Minority Interest', 'Total Liabilities'], limit=1)
    total_equity = _extract_series_values(quarterly_balance_sheet, ['Stockholders Equity', 'Common Stock Equity', 'Total Equity Gross Minority Interest'], limit=1)
    current_assets = _extract_series_values(quarterly_balance_sheet, ['Current Assets'], limit=1)
    current_liabilities = _extract_series_values(quarterly_balance_sheet, ['Current Liabilities'], limit=1)

    debt_ratio = None
    current_ratio = None
    if total_liabilities and total_equity and total_liabilities[0] is not None and total_equity[0] not in (None, 0):
        debt_ratio = round(total_liabilities[0] / total_equity[0] * 100, 2)
    if current_assets and current_liabilities and current_assets[0] is not None and current_liabilities[0] not in (None, 0):
        current_ratio = round(current_assets[0] / current_liabilities[0] * 100, 2)

    pbr = _try_pbr_from_balance_sheets(info, quote, annual_balance_sheet, quarterly_balance_sheet, pbr)
    pbr = _valuation_ratio_displayable(pbr)

    indicator_metrics = {
        'market_cap': market_cap,
        'dividend_yield': dividend_yield,
        'per': per,
        'pbr': pbr,
        'roe': roe,
        'psr': psr,
        'foreign_ownership_rate': foreign_rate,
    }

    return {
        'code': code,
        'name': name,
        'quote': quote,
        'indicators': indicator_metrics,
        'valuation_comparison': _build_valuation_comparison(code, indicator_metrics),
        'investor_flows': investor_flows,
        'news': _build_domestic_news_items(code, name, limit=5),
        'financials': {
            'performance': performance,
            'statements': statements,
            'stability': {
                'debt_ratio': debt_ratio,
                'current_ratio': current_ratio,
            },
            'dividends': {
                'payment_count': dividend_count,
                'dividend_per_share': _safe_round(last_dividend, 2),
                'dividend_yield': dividend_yield,
                'last_dividend_date': last_dividend_date,
            },
        },
        'meta': {
            'sector': info.get('sector') or '',
            'industry': info.get('industry') or '',
            'currency': info.get('currency') or 'KRW',
            'source': 'KIS+yfinance',
        },
    }


def _load_stock_detail_snapshot(cache_key: str):
    """MySQL stock_detail_snapshots 에서 TTL 이내 detail 로드. 테이블 없음 등은 None."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT payload_json, fetched_at FROM stock_detail_snapshots WHERE cache_key=%s LIMIT 1',
                    (cache_key,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception as exc:
        logging.getLogger(__name__).warning('[stock-detail] snapshot read skipped: %s', exc)
        return None
    if not row:
        return None
    fetched = row.get('fetched_at')
    if not isinstance(fetched, datetime):
        return None
    try:
        age_sec = time.time() - fetched.timestamp()
    except Exception:
        return None
    if age_sec < 0 or age_sec > _STOCK_DETAIL_DB_TTL:
        return None
    raw = row.get('payload_json')
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return None


def _save_stock_detail_snapshot(cache_key: str, code: str, detail: dict) -> None:
    """detail 을 DB에 UPSERT. 실패해도 API 응답은 유지."""
    ck = cache_key[:384]
    code6 = str(code or '').strip()[:6]
    try:
        blob = json.dumps(detail, ensure_ascii=False, default=str)
    except Exception as exc:
        logging.getLogger(__name__).warning('[stock-detail] snapshot json skip: %s', exc)
        return
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO stock_detail_snapshots (cache_key, stock_code, payload_json, fetched_at)
                    VALUES (%s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                      stock_code = VALUES(stock_code),
                      payload_json = VALUES(payload_json),
                      fetched_at = VALUES(fetched_at)
                    """,
                    (ck, code6, blob),
                )
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
        finally:
            conn.close()
    except Exception as exc:
        logging.getLogger(__name__).warning('[stock-detail] snapshot write skipped: %s', exc)


# `serve_stock_detail` — 모듈 내부 헬퍼.
def serve_stock_detail(code):
    _bump_stock_popularity_view(code)
    name = request.args.get('name') or LIVE_PRICE_STOCKS.get(code) or PRICE_STOCKS.get(code) or code
    cache_key = f'{code}:{name}'[:384]
    cached = _STOCK_DETAIL_CACHE.get(cache_key)
    if cached and (time.time() - cached['ts'] < _STOCK_DETAIL_CACHE_TTL):
        detail = cached['data']
        flows = detail.get('investor_flows') if isinstance(detail, dict) else None
        if not (isinstance(flows, dict) and flows.get('available')):
            detail['investor_flows'] = _build_investor_flow_payload(code)
        _rehydrate_quote_for_krx_display(code, detail.get('quote') if isinstance(detail, dict) else None)
        return jsonify({
            'success': True,
            'cached': True,
            'cache_source': 'memory',
            'ts': cached['clock'],
            'detail': detail,
        })

    snap = _load_stock_detail_snapshot(cache_key)
    if snap:
        flows = snap.get('investor_flows') if isinstance(snap, dict) else None
        if not (isinstance(flows, dict) and flows.get('available')):
            snap['investor_flows'] = _build_investor_flow_payload(code)
        _rehydrate_quote_for_krx_display(code, snap.get('quote') if isinstance(snap, dict) else None)
        clock = time.strftime('%H:%M:%S')
        _STOCK_DETAIL_CACHE[cache_key] = {'ts': time.time(), 'clock': clock, 'data': snap}
        return jsonify({
            'success': True,
            'cached': True,
            'cache_source': 'db',
            'ts': clock,
            'detail': snap,
        })

    token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None
    try:
        detail = _build_stock_detail_payload(code, name, token)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

    _rehydrate_quote_for_krx_display(code, detail.get('quote') if isinstance(detail, dict) else None)
    clock = time.strftime('%H:%M:%S')
    _STOCK_DETAIL_CACHE[cache_key] = {'ts': time.time(), 'clock': clock, 'data': detail}
    _save_stock_detail_snapshot(cache_key, code, detail)
    return jsonify({
        'success': True,
        'cached': False,
        'cache_source': 'live',
        'ts': clock,
        'detail': detail,
    })


# `_kis_get_token` — 한국투자 Open API 접근 토큰 (POST /oauth2/tokenP, client_credentials).
# 사용자 Google 로그인 OAuth 와 별개: appkey/appsecret 으로 서버가 시세 API 를 호출할 때만 사용.
def _kis_get_token():
    global _KIS_TOKEN_CACHE, _KIS_TOKEN_SAVED_AT, _KIS_TOKEN_DEADLINE

    now = time.time()
    if _KIS_TOKEN_CACHE and now < _KIS_TOKEN_DEADLINE:
        return _KIS_TOKEN_CACHE

    if _KIS_TOKEN_USE_DB:
        try:
            conn = get_db_connection()
            try:
                row = kis_token_db.load_valid_token_row(conn)
                if row and row.get('access_token'):
                    _KIS_TOKEN_CACHE = row['access_token']
                    _KIS_TOKEN_SAVED_AT = now
                    exp = row.get('expired_at')
                    if hasattr(exp, 'timestamp'):
                        _KIS_TOKEN_DEADLINE = min(now + 18000, float(exp.timestamp()) - 120)
                    else:
                        _KIS_TOKEN_DEADLINE = now + 18000
                    return _KIS_TOKEN_CACHE
            finally:
                conn.close()
        except Exception as e:
            print(f'[KIS] api_tokens 로드 실패: {e}')

    if os.path.exists(_KIS_TOKEN_FILE):
        with open(_KIS_TOKEN_FILE) as f:
            d = json.load(f)
        saved_at = float(d.get('saved_at') or 0)
        if now - saved_at < 18000:
            tok = d.get('access_token')
            _KIS_TOKEN_CACHE = tok
            _KIS_TOKEN_SAVED_AT = saved_at
            _KIS_TOKEN_DEADLINE = saved_at + 18000
            if _KIS_TOKEN_USE_DB and tok:
                try:
                    c2 = get_db_connection()
                    try:
                        if kis_token_db.ensure_token_saved_if_absent(c2, tok):
                            c2.commit()
                            print('[KIS] api_tokens: 파일 토큰을 DB에 백필했습니다.')
                    except Exception as dbe:
                        c2.rollback()
                        print(f'[KIS] api_tokens 백필 실패: {dbe}')
                    finally:
                        c2.close()
                except Exception as conn_err:
                    print(f'[KIS] api_tokens 백필 DB 연결 실패: {conn_err}')
            return _KIS_TOKEN_CACHE
    if not _KIS_KEY or not _KIS_SECRET:
        return None
    try:
        res = requests.post(
            f'{_KIS_BASE}/oauth2/tokenP',
            json={'grant_type': 'client_credentials', 'appkey': _KIS_KEY, 'appsecret': _KIS_SECRET},
            timeout=10,
        )
        if res.status_code == 200:
            token = res.json().get('access_token')
            if token:
                saved_at = time.time()
                with open(_KIS_TOKEN_FILE, 'w') as f:
                    json.dump({'access_token': token, 'saved_at': saved_at}, f)
                _KIS_TOKEN_CACHE = token
                _KIS_TOKEN_SAVED_AT = saved_at
                _KIS_TOKEN_DEADLINE = saved_at + 18000
                if _KIS_TOKEN_USE_DB:
                    try:
                        conn = get_db_connection()
                        try:
                            kis_token_db.save_token(conn, token)
                            conn.commit()
                            print('[KIS] api_tokens: 신규 발급 토큰을 DB에 저장했습니다.')
                        except Exception as dbe:
                            conn.rollback()
                            print(f'[KIS] api_tokens 저장 실패: {dbe}')
                        finally:
                            conn.close()
                    except Exception as conn_err:
                        print(f'[KIS] api_tokens DB 연결 실패: {conn_err}')
                return token
    except Exception:
        pass
    return None


# `_kis_fetch_one` — 모듈 내부 헬퍼.
def _kis_fetch_one(token, code, tr_id):
    try:
        res = requests.get(
            f'{_KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price',
            headers={
                'Content-Type': 'application/json',
                'authorization': f'Bearer {token}',
                'appkey': _KIS_KEY,
                'appsecret': _KIS_SECRET,
                'tr_id': tr_id,
            },
            params={'fid_cond_mrkt_div_code': 'J', 'fid_input_iscd': code},
            timeout=10,
        )
    except Exception as e:
        return None, str(e)

    try:
        body = res.json()
    except ValueError:
        return None, f'HTTP {res.status_code}'

    if res.status_code != 200:
        err = body.get('message') or body.get('msg1') or f'HTTP {res.status_code}'
        return None, err

    rt = body.get('rt_cd')
    if rt not in ('0', 0, None):
        msg_cd = body.get('msg_cd') or body.get('message', '')
        return None, msg_cd

    return body.get('output', {}), None


# inquire-asking-price-exp-ccn 의 output / output1 dict 파싱.
def _parse_kis_orderbook_output(raw):
    """inquire-asking-price-exp-ccn 의 output / output1 dict 파싱."""
    if raw is None:
        return None
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    if not isinstance(raw, dict):
        return None
    asks = []
    bids = []
    for i in range(1, 11):
        p = _to_int(raw.get(f'askp{i}'))
        if p > 0:
            asks.append({'price': p, 'quantity': _to_int(raw.get(f'askp_rsqn{i}'))})
        p = _to_int(raw.get(f'bidp{i}'))
        if p > 0:
            bids.append({'price': p, 'quantity': _to_int(raw.get(f'bidp_rsqn{i}'))})
    exp = _to_int(raw.get('antc_cnpr'))
    exp_chg = _to_int(raw.get('antc_cntg_vrss'))
    return {
        'asks': asks,
        'bids': bids,
        'expected_exec_price': exp,
        'expected_change': exp_chg,
        'total_ask_qty': _to_int(raw.get('total_askp_rsqn')),
        'total_bid_qty': _to_int(raw.get('total_bidp_rsqn')),
    }


# 한국투자 API 초당 거래 건수(TPS) 초과 등 — 재시도 시 더 악화되므로 즉시 중단.
def _kis_asking_rate_limited(msg) -> bool:
    """한국투자 API 초당 거래 건수(TPS) 초과 등 — 재시도 시 더 악화되므로 즉시 중단."""
    if not msg:
        return False
    s = str(msg)
    if '초당' in s or '거래건수' in s or '호출' in s and '초과' in s:
        return True
    if 'EGW' in s and '초과' in s:
        return True
    if '429' in s or 'Too Many Requests' in s:
        return True
    return False


# 동일 앱에서 호가 API 연속 호출 간 최소 간격 (KIS 제한 완화).
def _kis_throttle_asking_call():
    """동일 앱에서 호가 API 연속 호출 간 최소 간격 (KIS 제한 완화)."""
    global _KIS_ASKING_LAST_CALL
    with _KIS_ASKING_GAP_LOCK:
        gap = _KIS_ASKING_MIN_GAP
        now = time.time()
        elapsed = now - _KIS_ASKING_LAST_CALL
        if elapsed < gap:
            time.sleep(gap - elapsed)
        _KIS_ASKING_LAST_CALL = time.time()


# 호가·예상체결: 1차 TR 후, 초당한도가 아니면 보조 TR 1회(없는 서비스 코드 등 대응).
def _kis_fetch_asking_price_exp_ccn(token, code):
    """호가·예상체결: 1차 TR 후, 초당한도가 아니면 보조 TR 1회(없는 서비스 코드 등 대응)."""

    def _one(tr_id):
        """(성공 payload dict | None, 에러문자|None, rate_limited bool)"""
        _kis_throttle_asking_call()
        try:
            res = requests.get(
                f'{_KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn',
                headers={
                    'Content-Type': 'application/json',
                    'authorization': f'Bearer {token}',
                    'appkey': _KIS_KEY,
                    'appsecret': _KIS_SECRET,
                    'tr_id': tr_id,
                },
                params={'fid_cond_mrkt_div_code': 'J', 'fid_input_iscd': code},
                timeout=12,
            )
        except Exception as e:
            return None, str(e), False
        if res.status_code == 429:
            return None, '요청이 많아 잠시 후 다시 시도해 주세요. (초당 한도)', True
        try:
            body = res.json()
        except ValueError:
            return None, f'HTTP {res.status_code}', False
        if res.status_code != 200:
            msg = body.get('msg1') or body.get('message') or f'HTTP {res.status_code}'
            return None, msg, _kis_asking_rate_limited(msg)
        rt = body.get('rt_cd')
        if rt not in ('0', 0, None):
            msg = body.get('msg1') or body.get('message') or str(rt)
            return None, msg, _kis_asking_rate_limited(msg)
        raw = body.get('output')
        if raw is None:
            raw = body.get('output1')
        parsed = _parse_kis_orderbook_output(raw)
        if parsed and (parsed['asks'] or parsed['bids'] or parsed.get('expected_exec_price', 0) > 0):
            return parsed, None, False
        msg = body.get('msg1') or '호가 데이터가 비어 있습니다.'
        return None, msg, False

    code = str(code or '').strip()
    parsed, err, rate_hit = _one(_KIS_TR_ASK)
    if parsed:
        return parsed, None
    if rate_hit:
        return None, err
    if _KIS_ASKING_SKIP_FB:
        return None, err or '호가 조회 실패'
    time.sleep(_KIS_ASKING_SECOND_TR_GAP)
    parsed2, err2, rate_hit2 = _one(_KIS_TR_ASK_FB)
    if parsed2:
        return parsed2, None
    if rate_hit2:
        return None, err2
    return None, err2 or err or '호가 API 응답을 해석하지 못했습니다.'


# 시세 캐시 일부 갱신 (스레드에서 호출).
def _refresh_live_cache(selected_items, token):
    """시세 캐시 일부 갱신 (스레드에서 호출)."""
    global _LIVE_PRICE_CURSOR, _LIVE_UPDATER_RUNNING, _LIVE_LAST_UPDATE_AT

    total = len(selected_items)
    if total == 0:
        with _LIVE_PRICE_LOCK:
            _LIVE_UPDATER_RUNNING = False
            _LIVE_LAST_UPDATE_AT = time.time()
        return

    kis_ok = _kis_fetch_allowed_now()
    eff_token = token if kis_ok else None

    with _LIVE_PRICE_LOCK:
        cached_count = sum(1 for code, _ in selected_items if code in _LIVE_PRICE_CACHE)
        refresh_count = _WEB_REFRESH_BATCH_SIZE
        if cached_count == 0:
            refresh_count = max(_WEB_WARMUP_BATCH_SIZE, _WEB_REFRESH_BATCH_SIZE)
        refresh_count = max(1, min(refresh_count, total))

        start = _LIVE_PRICE_CURSOR % total
        indices = [(start + i) % total for i in range(refresh_count)]
        _LIVE_PRICE_CURSOR = (start + refresh_count) % total

    synced_items = []
    for seq, idx in enumerate(indices):
        code, name = selected_items[idx]
        if seq > 0 and _WEB_REQUEST_GAP_SEC > 0:
            time.sleep(_WEB_REQUEST_GAP_SEC)

        payload = None
        err = None
        if eff_token and _KIS_KEY and _KIS_SECRET:
            out = None
            for tr_id in (_KIS_TR, _KIS_TR_FB):
                out, err = _kis_fetch_one(eff_token, code, tr_id)
                if out is not None:
                    payload = _build_stock_payload(code, name, out)
                    break

        if payload is None:
            payload, yf_err = _fetch_yfinance_quote(code, name)
            if payload is None:
                err = yf_err or err

        with _LIVE_PRICE_LOCK:
            if payload is not None:
                _LIVE_PRICE_CACHE[code] = payload
                synced_items.append(payload)
            else:
                previous = _LIVE_PRICE_CACHE.get(code)
                if previous:
                    _LIVE_PRICE_CACHE[code] = {
                        **previous,
                        'name': name,
                        'stale': True,
                        'error': None,
                    }
                else:
                    _LIVE_PRICE_CACHE[code] = {
                        'code': code,
                        'name': name,
                        'loading': True,
                        'error': err,
                    }

    if _LIVE_PRICE_DB_SYNC_ENABLED and sync_live_price_batch and synced_items:
        sync_live_price_batch(synced_items)

    with _LIVE_PRICE_LOCK:
        _LIVE_UPDATER_RUNNING = False
        _LIVE_LAST_UPDATE_AT = time.time()


# 요청 종목 시세 전부 순차 갱신.
def _refresh_live_cache_full(selected_items, token):
    """요청 종목 시세 전부 순차 갱신."""
    if not selected_items:
        return
    if not _SECTOR_FULL_REFRESH_GUARD.acquire(blocking=False):
        return
    gap = float(os.getenv('LIVE_PRICE_SECTOR_GAP_SEC', str(_WEB_REQUEST_GAP_SEC)))
    synced_items = []
    kis_ok = _kis_fetch_allowed_now()
    eff_token = token if kis_ok else None
    try:
        max_n = int(os.getenv('LIVE_PRICE_SECTOR_SYNC_MAX', '40'))
        items = selected_items[:max_n]
        for seq, (code, name) in enumerate(items):
            if seq > 0 and gap > 0:
                time.sleep(gap)
            payload = None
            err = None
            if eff_token and _KIS_KEY and _KIS_SECRET:
                out = None
                for tr_id in (_KIS_TR, _KIS_TR_FB):
                    out, err = _kis_fetch_one(eff_token, code, tr_id)
                    if out is not None:
                        payload = _build_stock_payload(code, name, out)
                        break
            if payload is None:
                payload, yf_err = _fetch_yfinance_quote(code, name)
                if payload is None:
                    err = yf_err or err
            with _LIVE_PRICE_LOCK:
                if payload is not None:
                    _LIVE_PRICE_CACHE[code] = payload
                    synced_items.append(payload)
                else:
                    previous = _LIVE_PRICE_CACHE.get(code)
                    if previous and not previous.get('loading'):
                        _LIVE_PRICE_CACHE[code] = {
                            **previous,
                            'name': name,
                            'stale': True,
                            'error': None,
                        }
                    else:
                        _LIVE_PRICE_CACHE[code] = {
                            'code': code,
                            'name': name,
                            'loading': True,
                            'error': err,
                        }
        if _LIVE_PRICE_DB_SYNC_ENABLED and sync_live_price_batch and synced_items:
            sync_live_price_batch(synced_items)
    finally:
        _SECTOR_FULL_REFRESH_GUARD.release()


# 시세 갱신 스레드 시작.
def _start_live_refresh(selected_items, token, force=False):
    """시세 갱신 스레드 시작."""
    global _LIVE_UPDATER_RUNNING
    if not selected_items:
        return False

    with _LIVE_PRICE_LOCK:
        if _LIVE_UPDATER_RUNNING:
            return False
        if (not force) and (time.time() - _LIVE_LAST_UPDATE_AT < _WEB_UPDATE_INTERVAL_SEC):
            return False
        _LIVE_UPDATER_RUNNING = True

    t = threading.Thread(target=_refresh_live_cache, args=(selected_items, token), daemon=True)
    t.start()
    return True


# 시세 백그라운드 폴링.
def _live_price_background_loop():
    """시세 백그라운드 폴링."""
    while True:
        try:
            items = _get_live_price_universe_items()
            token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None
            _start_live_refresh(items, token, force=True)
        except Exception as e:
            print(f'[LIVE_BG] 갱신 루프 오류: {e}')
        time.sleep(max(1.0, _LIVE_BG_INTERVAL_SEC))


# 장 마감 직후 1회: pykrx 일봉으로 그날 OHLC + 종가를 stock_price_daily 에 확정 반영.
# 설명( sync_live_price_batch 는 장중 마지막 동기화 시점의 '현재가' 를 close_price 로 덮어쓰기 때문에 토스의 거래소 공식 종가와 작게는 몇 호가, 크게는 시간외 단일가 차이가 날 수 있다. EOD 작업은 그 격차를 없애기 위함. )
def _run_eod_close_fix():
    """장 마감 직후 1회: pykrx 일봉으로 그날 OHLC + 종가를 stock_price_daily 에 확정 반영.

    sync_live_price_batch 는 장중 마지막 동기화 시점의 '현재가' 를 close_price 로 덮어쓰기 때문에
    토스의 거래소 공식 종가와 작게는 몇 호가, 크게는 시간외 단일가 차이가 날 수 있다.
    EOD 작업은 그 격차를 없애기 위함.
    """
    global _LIVE_EOD_PYKRX_SKIP_DATE
    if pykrx_stock is None or not sync_live_price_batch:
        print('[EOD_FIX] pykrx 또는 sync_live_price_batch 미가용. 스킵.')
        return

    today = datetime.now().strftime('%Y%m%d')
    if _LIVE_EOD_PYKRX_SKIP_DATE == today:
        print('[EOD_FIX] pykrx 실패 이력으로 오늘 EOD 동기화 스킵.')
        return
    items = _get_live_price_universe_items()
    if not items:
        return

    probe_code = str(items[0][0])
    try:
        probe_df = pykrx_stock.get_market_ohlcv(today, today, probe_code, adjusted=False)
        if probe_df is None or getattr(probe_df, 'empty', True):
            _LIVE_EOD_PYKRX_SKIP_DATE = today
            print('[EOD_FIX] pykrx 일봉 응답 없음(비거래일/장마감 미확정 가능). 오늘 EOD 동기화 스킵.')
            return
    except Exception as e:
        _LIVE_EOD_PYKRX_SKIP_DATE = today
        print(f'[EOD_FIX] pykrx 프리체크 실패: {e}')
        return

    payloads = []
    for code, name in items:
        try:
            df = pykrx_stock.get_market_ohlcv(today, today, code, adjusted=False)
        except Exception as e:
            print(f'[EOD_FIX] pykrx 조회 실패 ({code}): {e}')
            continue
        if df is None or getattr(df, 'empty', True):
            continue
        try:
            row = df.iloc[-1]
            close_p = int(round(float(row.get('종가') or row.get('Close') or 0)))
            if close_p <= 0:
                continue
            open_p = int(round(float(row.get('시가') or row.get('Open') or close_p)))
            high_p = int(round(float(row.get('고가') or row.get('High') or close_p)))
            low_p = int(round(float(row.get('저가') or row.get('Low') or close_p)))
            volume = int(round(float(row.get('거래량') or row.get('Volume') or 0)))
        except Exception as e:
            print(f'[EOD_FIX] 행 파싱 실패 ({code}): {e}')
            continue

        # prev_close 는 pykrx 로 직전 거래일 종가를 한 번 더 받아야 하지만, 비용이 크므로
        # 동기화 로직의 ON DUPLICATE KEY UPDATE COALESCE 규칙에 맡겨 기존 값을 유지한다.
        payloads.append({
            'code': code,
            'name': name,
            'price': close_p,
            'open': open_p,
            'high': high_p,
            'low': low_p,
            'volume': volume,
        })

    if not payloads:
        print('[EOD_FIX] 반영 대상 없음.')
        return

    try:
        n = sync_live_price_batch(payloads)
        print(f'[EOD_FIX] 종가 확정 반영: {n} 종목')
    except Exception as e:
        print(f'[EOD_FIX] DB 동기화 실패: {e}')


# 평일 _LIVE_EOD_FIX_HHMM(기본 15:35) 에 한 번 EOD 종가 확정 동기화 실행.
def _eod_close_fix_loop():
    """평일 _LIVE_EOD_FIX_HHMM(기본 15:35) 에 한 번 EOD 종가 확정 동기화 실행."""
    last_run_date = None
    while True:
        try:
            now = datetime.now()
            today_key = now.strftime('%Y-%m-%d')
            hhmm = now.hour * 100 + now.minute
            if (
                now.weekday() < 5
                and hhmm >= _LIVE_EOD_FIX_HHMM
                and last_run_date != today_key
            ):
                _run_eod_close_fix()
                last_run_date = today_key
        except Exception as e:
            print(f'[EOD_FIX] 루프 오류: {e}')
        time.sleep(60)


# 시세 백그라운드 워커 1회 시작.
def _ensure_live_price_background_worker():
    """시세 백그라운드 워커 1회 시작."""
    global _LIVE_BG_WORKER_STARTED, _LIVE_EOD_WORKER_STARTED

    if app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return

    if _LIVE_BG_ENABLED and not _LIVE_BG_WORKER_STARTED:
        _LIVE_BG_WORKER_STARTED = True
        t = threading.Thread(target=_live_price_background_loop, daemon=True)
        t.start()

    if _LIVE_EOD_FIX_ENABLED and not _LIVE_EOD_WORKER_STARTED:
        _LIVE_EOD_WORKER_STARTED = True
        t_eod = threading.Thread(target=_eod_close_fix_loop, daemon=True)
        t_eod.start()


# 시세 행 목록 (캐시·DB·loading 순).
def _ordered_stock_rows(selected_items, snapshot):
    """시세 행 목록 (캐시·DB·loading 순)."""
    rows = []
    with _LIVE_PRICE_LOCK:
        for code, name in selected_items:
            cached = _LIVE_PRICE_CACHE.get(code)
            if cached and not cached.get('loading'):
                rows.append({**cached, 'name': name})
                continue
            db_row = (snapshot or {}).get(code)
            if db_row:
                rows.append({**db_row, 'name': name})
            elif cached:
                rows.append({**cached, 'name': name})
            else:
                rows.append({'code': code, 'name': name, 'loading': True})
    return rows


# 장외 yfinance 보강 대상: 미조회 행 또는 DB에 전일 종가가 없어 등락을 못 쓴 행.
def _offhours_row_needs_yfinance(row):
    """장외 yfinance 보강 대상: 미조회 행 또는 DB에 전일 종가가 없어 등락을 못 쓴 행."""
    if row.get('loading'):
        return True
    try:
        price = int(row.get('price') or 0)
    except (TypeError, ValueError):
        return False
    if price <= 0:
        return False
    if 'previous_close' not in row:
        return False
    try:
        pc = int(row['previous_close'] or 0)
    except (TypeError, ValueError):
        return False
    if pc <= 0:
        return True

    # DB 일봉 최신 날짜가 N일 이상 지났으면 stale — 가격은 stocks.current_price 등으로 보이나
    # 실제 거래일 종가와 어긋날 수 있어 yfinance 로 갱신 (예산은 LIVE_PRICE_OFFHOURS_YF_BUDGET)
    if _LIVE_OFFHOURS_STALE_DAYS > 0:
        latest_raw = row.get('latest_date')
        if latest_raw:
            try:
                today = datetime.now().date()
                if isinstance(latest_raw, str):
                    ld = datetime.strptime(str(latest_raw)[:10], '%Y-%m-%d').date()
                elif isinstance(latest_raw, datetime):
                    ld = latest_raw.date()
                elif isinstance(latest_raw, date):
                    ld = latest_raw
                else:
                    ld = latest_raw
                age_days = (today - ld).days
                if age_days >= _LIVE_OFFHOURS_STALE_DAYS:
                    return True
            except Exception:
                pass
    return False


# 장외: loading·전일종가 누락 행을 yfinance로 채움(요청당 상한). 성공 시 메모리 캐시에도 저장.
def _offhours_fill_yfinance_rows(full_rows, all_items, budget):
    """장외: loading·전일종가 누락 행을 yfinance로 채움(요청당 상한). 성공 시 메모리 캐시에도 저장."""
    if budget <= 0 or not full_rows or len(full_rows) != len(all_items):
        return
    used = 0
    for i, (code, name) in enumerate(all_items):
        if used >= budget:
            break
        row = full_rows[i]
        if not _offhours_row_needs_yfinance(row):
            continue
        if used > 0 and _WEB_REQUEST_GAP_SEC > 0:
            time.sleep(_WEB_REQUEST_GAP_SEC)
        payload, _err = _fetch_yfinance_quote(code, name)
        used += 1
        if payload:
            merged = {**payload, 'name': name, 'stale': True}
            full_rows[i] = merged
            with _LIVE_PRICE_LOCK:
                _LIVE_PRICE_CACHE[code] = merged


# 실시간 시세 API.
def serve_live_prices():
    """실시간 시세 API."""
    global _LIVE_PRICE_CURSOR, _LIVE_UPDATER_RUNNING

    try:
        page_size = int(request.args.get('page_size', request.args.get('limit', '10')))
    except ValueError:
        page_size = 10
    page_size = max(1, min(page_size, _WEB_PRICE_MAX_COUNT))

    try:
        page = int(request.args.get('page', '1'))
    except ValueError:
        page = 1
    page = max(1, page)

    price_filter = (request.args.get('filter') or 'all').strip().lower()
    if price_filter not in ('all', 'up', 'down', 'volume'):
        price_filter = 'all'

    custom_codes_raw = (request.args.get('codes') or '').strip()
    custom_names_raw = (request.args.get('names') or '').strip()

    custom_name_map = {}
    if custom_names_raw:
        for pair in custom_names_raw.split('|'):
            if ':' not in pair:
                continue
            code, name = pair.split(':', 1)
            code = code.strip()
            name = name.strip()
            if code and name:
                custom_name_map[code] = name

    token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None

    if custom_codes_raw:
        dedup_codes = []
        seen = set()
        for code in custom_codes_raw.split(','):
            cleaned = code.strip()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            dedup_codes.append(cleaned)

        all_items = []
        for code in dedup_codes[:_WEB_PRICE_MAX_COUNT]:
            name = custom_name_map.get(code) or LIVE_PRICE_STOCKS.get(code) or PRICE_STOCKS.get(code) or code
            all_items.append((code, name))
    else:
        all_items = _get_live_price_universe_items()

    if custom_codes_raw:
        price_filter = 'all'

    universe_count = len(all_items)
    if universe_count == 0:
        return jsonify({'success': True, 'count': 0, 'stocks': [], 'ts': time.strftime('%H:%M:%S')})

    market_open = _live_fetch_enabled_now()
    if not market_open:
        # 장외: DB 스냅샷 우선 → 빈 종목은 (옵션) 메모리 캐시 → (옵션) yfinance로 보강
        snapshot = {}
        if fetch_live_snapshot_batch:
            snapshot = fetch_live_snapshot_batch([c for c, _ in all_items]) or {}

        full_rows = []
        for code, name in all_items:
            row = snapshot.get(code)
            if row:
                full_rows.append({**row, 'name': name})
                continue
            cached_row = None
            if _LIVE_OFFHOURS_USE_CACHE:
                with _LIVE_PRICE_LOCK:
                    c = _LIVE_PRICE_CACHE.get(code)
                if c and not c.get('loading') and c.get('price') is not None:
                    cached_row = {**c, 'name': name, 'stale': True}
            if cached_row:
                full_rows.append(cached_row)
            else:
                full_rows.append({'code': code, 'name': name, 'loading': True})

        if _LIVE_OFFHOURS_YFINANCE:
            _offhours_fill_yfinance_rows(full_rows, all_items, _LIVE_OFFHOURS_YF_BUDGET)

        if price_filter in ('up', 'down'):
            filtered_rows = [
                r for r in full_rows
                if (not r.get('loading')) and ((r.get('direction') or 'flat') == price_filter)
            ]
        elif price_filter == 'volume':
            def _off_vol_key(r):
                if r.get('loading'):
                    return (1, 0)
                try:
                    v = int(r.get('volume') or 0)
                except (TypeError, ValueError):
                    v = 0
                return (0, -v)

            filtered_rows = sorted(full_rows, key=_off_vol_key)
        else:
            filtered_rows = full_rows

        total_filtered = len(filtered_rows)
        total_pages = max(1, (total_filtered + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages
        start_index = (page - 1) * page_size
        end_index = min(start_index + page_size, total_filtered)
        stocks = filtered_rows[start_index:end_index]
        return jsonify({
            'success': True,
            'count': len(stocks),
            'total_count': total_filtered,
            'universe_count': universe_count,
            'total_pages': total_pages,
            'page': page,
            'page_size': page_size,
            'filter': price_filter,
            'refresh_count': 0,
            'market_open': False,
            'stocks': stocks,
            'ts': time.strftime('%H:%M:%S')
        })

    if price_filter in ('up', 'down'):
        prime_items = []
        with _LIVE_PRICE_LOCK:
            if not _LIVE_UPDATER_RUNNING:
                miss = [c for c, _ in all_items if c not in _LIVE_PRICE_CACHE]
                if miss and len(miss) == universe_count:
                    prime_len = min(8, len(all_items))
                    prime_items = all_items[:prime_len]
        if prime_items:
            _refresh_live_cache(prime_items, token)

        _start_live_refresh(all_items, token, force=False)

        missing_for_snapshot = []
        with _LIVE_PRICE_LOCK:
            for code, name in all_items:
                cached = _LIVE_PRICE_CACHE.get(code)
                if not cached or cached.get('loading'):
                    missing_for_snapshot.append((code, name))

        snapshot = {}
        if missing_for_snapshot and fetch_live_snapshot_batch:
            snapshot = fetch_live_snapshot_batch([code for code, _ in missing_for_snapshot])

        full_stocks = _ordered_stock_rows(all_items, snapshot)

        def _matches_direction(row):
            if row.get('loading'):
                return False
            return (row.get('direction') or 'flat') == price_filter

        filtered = [s for s in full_stocks if _matches_direction(s)]
        total_filtered = len(filtered)
        total_pages = max(1, (total_filtered + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages
        start_i = (page - 1) * page_size
        stocks = filtered[start_i:start_i + page_size]

        refresh_count = _WEB_REFRESH_BATCH_SIZE
        if total_filtered == 0 or all(s.get('loading') for s in stocks):
            refresh_count = max(_WEB_WARMUP_BATCH_SIZE, _WEB_REFRESH_BATCH_SIZE)

        return jsonify({
            'success': True,
            'count': len(stocks),
            'total_count': total_filtered,
            'universe_count': universe_count,
            'total_pages': total_pages,
            'page': page,
            'page_size': page_size,
            'filter': price_filter,
            'refresh_count': refresh_count,
            'market_open': True,
            'stocks': stocks,
            'ts': time.strftime('%H:%M:%S')
        })

    if price_filter == 'volume':
        prime_items = []
        with _LIVE_PRICE_LOCK:
            if not _LIVE_UPDATER_RUNNING:
                miss = [c for c, _ in all_items if c not in _LIVE_PRICE_CACHE]
                if miss and len(miss) == universe_count:
                    prime_len = min(8, len(all_items))
                    prime_items = all_items[:prime_len]
        if prime_items:
            _refresh_live_cache(prime_items, token)

        _start_live_refresh(all_items, token, force=False)

        missing_for_snapshot = []
        with _LIVE_PRICE_LOCK:
            for code, name in all_items:
                cached = _LIVE_PRICE_CACHE.get(code)
                if not cached or cached.get('loading'):
                    missing_for_snapshot.append((code, name))

        snapshot = {}
        if missing_for_snapshot and fetch_live_snapshot_batch:
            snapshot = fetch_live_snapshot_batch([code for code, _ in missing_for_snapshot])

        full_stocks = _ordered_stock_rows(all_items, snapshot)

        def _live_vol_key(r):
            if r.get('loading'):
                return (1, 0)
            try:
                v = int(r.get('volume') or 0)
            except (TypeError, ValueError):
                v = 0
            return (0, -v)

        vol_sorted = sorted(full_stocks, key=_live_vol_key)
        total_filtered = len(vol_sorted)
        total_pages = max(1, (total_filtered + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages
        start_i = (page - 1) * page_size
        stocks = vol_sorted[start_i:start_i + page_size]

        refresh_count = _WEB_REFRESH_BATCH_SIZE
        if total_filtered == 0 or all(s.get('loading') for s in stocks):
            refresh_count = max(_WEB_WARMUP_BATCH_SIZE, _WEB_REFRESH_BATCH_SIZE)

        return jsonify({
            'success': True,
            'count': len(stocks),
            'total_count': total_filtered,
            'universe_count': universe_count,
            'total_pages': total_pages,
            'page': page,
            'page_size': page_size,
            'filter': 'volume',
            'refresh_count': refresh_count,
            'market_open': True,
            'stocks': stocks,
            'ts': time.strftime('%H:%M:%S')
        })

    total_pages = max(1, (universe_count + page_size - 1) // page_size)
    if page > total_pages:
        page = total_pages

    start_index = (page - 1) * page_size
    end_index = min(start_index + page_size, universe_count)
    selected_items = all_items[start_index:end_index]

    sector_sync_max = int(os.getenv('LIVE_PRICE_SECTOR_SYNC_MAX', '40'))
    sector_short = bool(custom_codes_raw and len(selected_items) <= sector_sync_max)
    snapshot_first = {}
    sync_refresh = (request.args.get('sync_refresh') or '').strip().lower() in ('1', 'true', 'yes', 'on')
    sync_one = bool(sector_short and len(selected_items) == 1 and sync_refresh)

    if sector_short:
        if fetch_live_snapshot_batch:
            snapshot_first = fetch_live_snapshot_batch([c for c, _ in selected_items]) or {}

        if sync_one:
            try:
                _refresh_live_cache(selected_items, token)
            except Exception as e:
                print(f'[live-prices sync_refresh] {e}')
        else:
            def _sector_live_bg():
                try:
                    _refresh_live_cache_full(selected_items, token)
                except Exception as e:
                    print(f'[live-prices sector bg] {e}')

            threading.Thread(target=_sector_live_bg, daemon=True).start()
    else:
        prime_items = []
        with _LIVE_PRICE_LOCK:
            if not _LIVE_UPDATER_RUNNING:
                missing_codes = [code for code, _ in selected_items if code not in _LIVE_PRICE_CACHE]
                if missing_codes and len(missing_codes) == len(selected_items):
                    prime_len = min(3, len(selected_items))
                    prime_items = selected_items[:prime_len]

        if prime_items:
            _refresh_live_cache(prime_items, token)

    if not sector_short:
        _start_live_refresh(selected_items, token, force=False)

    missing_for_snapshot = []
    with _LIVE_PRICE_LOCK:
        for code, name in selected_items:
            cached = _LIVE_PRICE_CACHE.get(code)
            if not cached or cached.get('loading'):
                missing_for_snapshot.append((code, name))

    snapshot_extra = {}
    if missing_for_snapshot and fetch_live_snapshot_batch:
        snapshot_extra = fetch_live_snapshot_batch([code for code, _ in missing_for_snapshot]) or {}

    merged_snap = {**snapshot_first, **snapshot_extra}
    stocks = _ordered_stock_rows(selected_items, merged_snap)

    refresh_count = _WEB_REFRESH_BATCH_SIZE
    if all(s.get('loading') for s in stocks):
        refresh_count = max(_WEB_WARMUP_BATCH_SIZE, _WEB_REFRESH_BATCH_SIZE)

    return jsonify({
        'success': True,
        'count': len(stocks),
        'total_count': universe_count,
        'total_pages': total_pages,
        'page': page,
        'page_size': page_size,
        'filter': 'all',
        'refresh_count': refresh_count,
        'market_open': True,
        'stocks': stocks,
        'ts': time.strftime('%H:%M:%S')
    })


if __name__ == '__main__':
    _ensure_live_price_background_worker()
    run_opts = flask_run_options()
    print(f"Server: http://{run_opts['host']}:{run_opts['port']}")
    app.run(**run_opts)
