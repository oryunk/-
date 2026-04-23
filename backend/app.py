from flask import Flask, request, jsonify, session, send_from_directory, abort
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import os
import time
import json
import re
import threading
import requests
import logging
from dotenv import load_dotenv
from decimal import Decimal, ROUND_HALF_UP

# yfinance 내부 에러 로그(종목 없음, JSON 파싱 등) 터미널 출력 억제
logging.getLogger('yfinance').setLevel(logging.CRITICAL)

try:
    from pykrx import stock as pykrx_stock
except Exception as pykrx_err:
    print(f'[WARN] pykrx 로드 실패: {pykrx_err}')
    pykrx_stock = None

try:
    from price import STOCKS as PRICE_STOCKS
except Exception as price_err:
    print(f'[WARN] price.STOCKS 로드 실패: {price_err}')
    PRICE_STOCKS = {}

try:
    from Live_price import sync_live_price_batch, fetch_live_snapshot_batch
except Exception as live_price_err:
    print(f'[WARN] Live_price DB sync 로드 실패: {live_price_err}')
    sync_live_price_batch = None
    fetch_live_snapshot_batch = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))
ENV_CANDIDATES = [
    os.path.join(BASE_DIR, '.env'),
    os.path.join(os.getcwd(), '.env'),
]
for env_path in ENV_CANDIDATES:
    if os.path.exists(env_path):
        load_dotenv(env_path)
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret-key")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_PATH"] = "/"

from auth_api import auth_bp, get_connection as get_db_connection
from cors_helpers import apply_cors_headers
import news_service

app.register_blueprint(auth_bp)


@app.after_request
def _cors_after_request(response):
    return apply_cors_headers(request, response)


@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        return apply_cors_headers(request, app.make_response(("", 204)))

# GPT(OpenAI) API 설정
OPENAI_API_KEY = (os.getenv('OPENAI_API_KEY') or os.getenv('GPT_API_KEY') or '').strip()
DEFAULT_GPT_MODEL = os.getenv('GPT_MODEL', 'gpt-5.4-mini').strip() or 'gpt-5.4-mini'
OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
GPT_AVAILABLE = bool(OPENAI_API_KEY)
if not GPT_AVAILABLE:
    print('[WARN] GPT API 키가 설정되지 않았습니다. 분석/용어 설명은 로컬 fallback 또는 오류 응답이 반환될 수 있습니다.')

# 종목 코드 매핑
STOCK_CODES = {
    '삼성전자': '005930.KS',
    'SK하이닉스': '000660.KS',
    'NAVER': '035420.KS',
    '카카오': '035720.KS',
    '현대차': '005380.KS',
    'LG전자': '066570.KS',
    'POSCO': '005490.KS',
}

_PRICE_NAME_TO_CODE = {}
for _code, _name in (PRICE_STOCKS or {}).items():
    _nm = str(_name or '').strip()
    if not _nm:
        continue
    _PRICE_NAME_TO_CODE[_nm.lower()] = str(_code).strip()
    _PRICE_NAME_TO_CODE[_nm.replace(' ', '').lower()] = str(_code).strip()

RSS_FEEDS = [
    'https://www.mk.co.kr/rss/50200011/'
]

NEWS_DB_SYNC = os.getenv('NEWS_DB_SYNC', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
NEWS_READER_DIGEST = os.getenv('NEWS_READER_DIGEST', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}

MASTER_PROMPT = """[MASTER PROMPT] 스몰캡 전략 v7.5: 자동 진행형 투자 분석 시스템 - Quantum Leap Hybrid Deep Analysis Edition

나의 역할
너는 Quantum Leap 팀 리더인 GPT이다.
너는 Harper, Benjamin, Lucas, Sophia와 함께 5명 팀으로 작동하며, 모든 분석은 팀원들의 전문 영역을 최대한 활용하면서 이전 단일 역할 프롬프트 수준 이상의 상세하고 깊은 분석을 제공한다. 불필요한 영어 출력은 제한하고, 최대한 적절한 한국어로 출력한다. 특히 용어 출력시 불필요하게 사용하지 않는다.

실제 팀 역할 분담
GPT (Team Leader): 전체 조율, 각 STAGE 종합, 추가 인사이트 보강, 최종 결론
Harper: Macro Sentinel (시장 국면, VIX, 매크로 환경, 메가트렌드 전문)
Benjamin: Fundamental Researcher + Risk Guardian (SEC 자료, 펀더멘털 체크리스트, Cash Runway·Dilution, Red Team, Kill Switch, 인지 편향 체크 전문)
Lucas: Technical Pattern Hunter (최신 차트 수집·패턴 분석, 상대강도, 시나리오 전문)

강화된 대화 프로토콜 (절대 준수)
자동 진행 모드 (기본값)
분석은 STAGE 0부터 STAGE 6까지 자동으로 연속 진행한다.
각 STAGE 완료 후 자동으로 다음 STAGE로 넘어간다.
사용자 개입 없이 전체 분석을 완료한다.

Kill Switch 예외 처리
Hard Kill 발생 시: 즉시 중단하고 사유 명시
Soft Warning 발생 시: 경고 표시 후 "계속 진행할까요? (Yes/No)"로 사용자 확인 요청

최종 단계
STAGE 6 완료 후 자동으로 "통합 분석 리포트를 생성할까요?" 질문
사용자가 Yes 입력 시에만 최종 보고서 출력

강화된 분석 원칙 (Hybrid Deep Mode)
각 에이전트는 분석 시 반드시 구체적인 숫자, 날짜, SEC 인용, 경영진 코멘트(MD&A) 등을 최대한 포함하고, 논리를 자세히 풀어서 설명한다.
GPT는 각 STAGE 끝에 "팀 의견 통합 + 추가 인사이트"를 반드시 추가한다.

Persistent State Protocol
대화 전체 히스토리를 완벽히 기억하며 이전 STAGE 결론을 자연스럽게 참조한다.

1-A. 정보 수집 및 검증 원칙
소스 한정: Bloomberg, Reuters, The Wall Street Journal, CNBC, Financial Times (U.S.), MarketWatch, Barron's, SEC EDGAR만 사용.
검색 쿼리는 영어로만 작성한다.

1-B. 자율적 데이터 수집 원칙
모든 데이터는 사용자 요청 없이 스스로 검색 확보한다.
성격 및 특징: 데이터 중심적, 규율적, 지적 겸손함.
핵심 전략: 평소 스나이퍼 모드, 완벽 셋업 시 야수 모드.
언어 프로토콜: 내부 검색·생각은 영어, 모든 사용자 응답은 한국어.

Kill Switch 프로토콜 v5.6 (Flexible Risk)
Hard Kill: Going Concern, SEC 조사, 사기 의심 등 치명적 리스크 → 즉시 중단
Soft Warning: Cash Runway <6개월, Dilution >25%, 🔴 3개 이상 등 → Override 여부 사용자에게 질문

분석 STAGE 구조 (자동 진행)
STAGE -1: 능동적 주도주 발굴
사용자가 발굴 모드 또는 메가트렌드를 지정하면 시총 20억 달러 이하, 주가 30달러 이하, 최근 3개월 내부자 매수 또는 주요 촉매가 있는 기업 3~5개를 제안한다.
STAGE 0: 시장 국면 분석 (Harper 주도)
시장 요약 센터, 포트폴리오 모드, 시장 심리, VIX 수준(현재값 + 최근 1주 추이), 핵심 시장 논리, 매크로 환경 분석(정치·경제·사회·기술), 주요 지수 전술 위치, 시장 등급(A+/B/F) 판정
STAGE 1: 메가트렌드 식별 (Harper 주도)
STAGE 2: 미래의 주도주 통합 분석 (Benjamin 주도)
STAGE 3: 장기 차트 셋업 및 시나리오 분석 (Lucas 주도)
STAGE 4: 포지션 구축 실행 계획 (GPT 종합)
STAGE 5: 최종 투자 논거 요약 (GPT 종합)
STAGE 6: 인지 편향 체크 (Benjamin 주도) → PASS / HOLD / REJECT

FINAL STAGE
모든 STAGE 완료 후 "통합 분석 리포트를 생성할까요?"라고 정확히 질문한다. Yes일 때만 전체 보고서를 출력한다.
"""

TERM_INTERPRETATION_PROMPT = """Sophia: Terminology interpretation
사용자가 질문한 특정 금융/투자 용어만 설명한다. (추가 용어 설명 금지)
설명 스타일: 친절한 금융 멘토처럼, 전문 용어 사용을 지양하고 쉬운 비유를 활용한다.

[답변 구조]
용어의 의미: 초보자의 눈높이에서 본질적인 정의를 한 줄로 요약한 후 보충 설명한다.
특징: 용어를 물어볼때만 설명한다.
실제 투자 활용 예시: 이 용어가 실제 시장 상황에서 어떻게 쓰이는가에 대한 시나리오나 예시를 제시한다.

[제약]
- 질문한 용어 외 다른 용어를 추가로 설명하지 않는다.
- 한국어로 답변한다.
"""

LOCAL_TERM_FALLBACK = {
    'per': '용어의 의미: PER은 주가가 이익에 비해 비싼지 싼지 보는 배수 지표입니다.\n특징: 같은 업종 내 기업끼리 비교할 때 유용합니다.\n실제 투자 활용 예시: 반도체 A와 B의 PER을 비교해 상대적으로 저평가된 종목을 후보로 고르는 식으로 씁니다.',
    'roe': '용어의 의미: ROE는 회사가 자기자본으로 얼마나 효율적으로 이익을 냈는지 보여주는 수익성 지표입니다.\n특징: 숫자가 높고 안정적으로 유지되면 경영 효율이 좋다고 봅니다.\n실제 투자 활용 예시: 같은 업종 기업 중 ROE가 꾸준히 높은 회사를 장기 보유 후보로 추리는 데 활용합니다.',
    'pbr': '용어의 의미: PBR은 주가가 장부상 순자산 대비 몇 배인지 보는 지표입니다.\n특징: 1배 이하면 자산가치 대비 저평가 가능성을 점검합니다.\n실제 투자 활용 예시: 경기 민감 업종에서 PBR이 낮은 종목을 골라 반등 구간을 노리는 전략에 사용합니다.',
    'eps': '용어의 의미: EPS는 주식 1주당 회사가 벌어들인 순이익입니다.\n특징: EPS가 늘면 기업의 이익 체력이 좋아지고 있다는 신호가 됩니다.\n실제 투자 활용 예시: 분기 실적 발표 후 EPS 증가 추세가 확인된 기업을 추세 매수 후보로 봅니다.',
    '배당주': '용어의 의미: 배당주는 이익 일부를 주주에게 배당금으로 꾸준히 나눠주는 주식입니다.\n특징: 시세차익뿐 아니라 현금흐름을 함께 노리는 투자에 적합합니다.\n실제 투자 활용 예시: 금리 하락기나 변동성 장세에서 월/분기 배당 종목을 모아 현금흐름 포트폴리오를 구성합니다.',
    '시가총액': '용어의 의미: 시가총액은 현재 주가에 발행주식 수를 곱한 기업의 시장가치입니다.\n특징: 대형주/중형주/소형주 분류의 기준이 됩니다.\n실제 투자 활용 예시: 시장 불안 시기에 시가총액 상위 대형주 중심으로 비중을 높여 변동성을 낮춥니다.',
    '변동성': '용어의 의미: 변동성은 가격이 얼마나 크게 흔들리는지 나타내는 위험 지표입니다.\n특징: 변동성이 높을수록 수익 기회와 손실 위험이 함께 커집니다.\n실제 투자 활용 예시: 변동성이 급등하면 분할매수 간격을 넓히고 손절 기준을 더 보수적으로 설정합니다.',
    '포트폴리오': '용어의 의미: 포트폴리오는 내가 보유한 투자자산의 구성표입니다.\n특징: 자산을 나눠 담아 한 종목 리스크를 줄이는 데 핵심입니다.\n실제 투자 활용 예시: 주식 60%, 채권 30%, 현금 10%처럼 비중을 정하고 정기적으로 리밸런싱합니다.'
}


def explain_term_with_local_fallback(term_name):
    normalized = (term_name or '').strip().lower()
    if normalized in LOCAL_TERM_FALLBACK:
        return LOCAL_TERM_FALLBACK[normalized]

    return (
        f"용어의 의미: {term_name}은(는) 투자 판단에 쓰이는 금융/투자 개념입니다.\n"
        "특징: 현재 AI 쿼터가 소진되어 간단 요약으로 우선 안내합니다.\n"
        f"실제 투자 활용 예시: {term_name}의 추이를 다른 지표와 함께 비교해 매수/매도 타이밍을 보조 판단합니다."
    )

def call_gpt(prompt_text, model=DEFAULT_GPT_MODEL):
    """OpenAI GPT API 호출 (용어 설명용)."""
    if not GPT_AVAILABLE:
        return {
            'success': False,
            'status_code': 500,
            'message': 'GPT API가 설정되지 않았습니다. OPENAI_API_KEY 또는 GPT_API_KEY를 확인해주세요.'
        }

    headers = {
        'Authorization': f'Bearer {OPENAI_API_KEY}',
        'content-type': 'application/json'
    }
    payload = {
        'model': model,
        'max_completion_tokens': 4000,
        'messages': [{'role': 'user', 'content': prompt_text}]
    }

    try:
        response = requests.post(OPENAI_API_URL, headers=headers, json=payload, timeout=40)
    except Exception as err:
        return {'success': False, 'status_code': 503, 'message': f'GPT 호출 실패: {err}'}

    if not response.ok:
        message = f'GPT API 호출 실패({response.status_code})'
        try:
            error_payload = response.json()
            api_msg = (((error_payload or {}).get('error') or {}).get('message') or '').strip()
            if api_msg:
                message = api_msg
        except Exception:
            pass
        upper_msg = message.upper()
        if ('CREDIT BALANCE IS TOO LOW' in upper_msg) or ('INSUFFICIENT' in upper_msg and 'CREDIT' in upper_msg) or ('INSUFFICIENT_QUOTA' in upper_msg):
            return {'success': False, 'status_code': 429, 'message': message}
        return {'success': False, 'status_code': response.status_code, 'message': message}

    try:
        data = response.json()
    except Exception:
        return {'success': False, 'status_code': 500, 'message': 'GPT 응답 JSON 파싱에 실패했습니다.'}

    choices = data.get('choices') or []
    first_choice = choices[0] if choices else {}
    message_obj = first_choice.get('message') if isinstance(first_choice, dict) else {}
    final_text = ((message_obj or {}).get('content') or '').strip()
    if not final_text:
        return {'success': False, 'status_code': 500, 'message': 'GPT 응답 텍스트가 비어 있습니다.'}

    return {'success': True, 'text': final_text}

def _resolve_chart_code(stock_name):
    """차트 API(/api/chart-data/<code>)용 코드. 한국 6자리면 숫자만, 그 외는 yfinance 티커 그대로."""
    _ticker, chart_code = _resolve_ticker_and_chart_code(stock_name)
    return chart_code


def _resolve_ticker_and_chart_code(stock_name):
    """
    사용자 입력(한글명/6자리코드/티커)을 yfinance ticker + 차트코드로 해석.
    - 한글명은 STOCK_CODES + price.STOCKS 역매핑으로 6자리 코드를 찾는다.
    - 6자리 숫자는 .KS를 기본으로 붙인다.
    """
    raw = (stock_name or '').strip()
    if not raw:
        return '', ''

    if raw in STOCK_CODES:
        ticker = STOCK_CODES[raw]
        chart_code = ticker.split('.')[0] if isinstance(ticker, str) and '.' in ticker else str(ticker)
        return str(ticker), str(chart_code)

    if len(raw) == 6 and raw.isdigit():
        return f'{raw}.KS', raw

    normalized = raw.replace(' ', '').lower()
    mapped_code = _PRICE_NAME_TO_CODE.get(raw.lower()) or _PRICE_NAME_TO_CODE.get(normalized)
    if mapped_code and len(mapped_code) == 6 and mapped_code.isdigit():
        return f'{mapped_code}.KS', mapped_code

    if re.fullmatch(r'[A-Za-z][A-Za-z0-9._-]*', raw):
        return raw.upper(), raw.upper()

    return raw, raw


def _safe_float(value, default=0.0):
    """NaN/inf/None 을 기본값으로 치환해 JSON 직렬화 오류를 방지."""
    try:
        num = float(value)
    except Exception:
        return float(default)
    if pd.isna(num) or num in (float('inf'), float('-inf')):
        return float(default)
    return num


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


def _coerce_gpt_opinion(value, fallback):
    allowed = {"강력매수", "매수", "보유", "약세"}
    v = str(value or "").strip()
    if v in allowed:
        return v
    return fallback


def _opinion_to_color(opinion):
    if opinion == "강력매수":
        return "green"
    if opinion == "매수":
        return "light-green"
    if opinion == "약세":
        return "red"
    return "gray"


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


def _resolve_stock_code_for_news(stock_name):
    _, chart_code = _resolve_ticker_and_chart_code(stock_name)
    code = str(chart_code or '').strip()
    if len(code) == 6 and code.isdigit():
        return code
    return ''


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


def _clamp(value, low, high):
    return max(low, min(high, value))


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
            gpt_summary = str(gpt_obj.get('summary') or '').strip()
            if gpt_summary:
                final_summary = gpt_summary
            final_color = _opinion_to_color(final_opinion)

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


def explain_term_with_gpt(term_name):
    """금융/투자 용어를 GPT로 설명"""
    prompt = (
        f"{TERM_INTERPRETATION_PROMPT}\n"
        f"[사용자 질문]\n{term_name}\n\n"
        "위 질문은 단일 금융/투자 용어 질문이다. 질문한 용어만 설명하고 답변 구조를 지켜라."
    )
    return call_gpt(prompt, model=DEFAULT_GPT_MODEL)


def fetch_rss_items(limit=12):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }

    for feed_url in RSS_FEEDS:
        try:
            response = requests.get(feed_url, headers=headers, timeout=10)
            response.raise_for_status()

            parsed = news_service.parse_rss_channel_bytes(
                response.content,
                feed_url,
                default_source='매일경제',
                limit=limit,
            )
            if not parsed:
                continue

            if NEWS_DB_SYNC:
                try:
                    conn = get_db_connection()
                    try:
                        news_service.upsert_rss_batch(conn, parsed)
                        conn.commit()
                        items = news_service.fetch_recent_list(conn, limit=limit)
                        return {'success': True, 'items': items, 'feed': feed_url, 'from_db': True}
                    except Exception as db_err:
                        conn.rollback()
                        import traceback
                        print(f'[RSS/DB] 동기화 실패, RSS 페이로드만 반환: {db_err}')
                        traceback.print_exc()
                    finally:
                        conn.close()
                except Exception as conn_err:
                    print(f'[RSS/DB] DB 연결 실패: {conn_err}')

            items = news_service.serialize_parsed_for_api(parsed)
            return {'success': True, 'items': items, 'feed': feed_url, 'from_db': False}
        except Exception as err:
            print(f'[RSS] 피드 로드 실패 ({feed_url}): {err}')

    return {'success': False, 'message': 'RSS 피드를 불러오지 못했습니다.'}


def _explain_news_reader_text(title: str, summary: str):
    """주린이 독자용 짧은 뉴스 해설 (GPT)."""
    body = (summary or '').strip()
    if len(body) > 3500:
        body = body[:3500] + '…'
    prompt = (
        '주린이 투자자에게 아래 경제·증시 뉴스를 쉽게 풀어서 설명하라.\n\n'
        f'[제목]\n{title}\n\n[요약]\n{body}\n\n'
        '[작성 규칙]\n'
        '- 한국어, 4~7문장.\n'
        '- 핵심 사실과 시장에서 왜 주목되는지(맥락)를 포함한다.\n'
        '- 특정 종목의 매수·매도를 직접 권유하지 않는다.\n'
        '- 확인되지 않은 추측은 완곡하게 표현한다.\n'
    )
    return call_gpt(prompt, model=DEFAULT_GPT_MODEL)


_NEWS_STOCK_KEYWORDS = {
    '삼성전자': '005930',
    '삼전': '005930',
    'SK하이닉스': '000660',
    'SK하닉': '000660',
    '하이닉스': '000660',
    'LG에너지솔루션': '373220',
    '에코프로비엠': '247540',
    '에코프로': '086520',
    '삼성SDI': '006400',
    '포스코퓨처엠': '003670',
    'POSCO퓨처엠': '003670',
}


def _extract_related_stock_codes(title: str, summary: str, max_count: int = 4):
    text = f"{title or ''}\n{summary or ''}"
    found = []
    for key, code in _NEWS_STOCK_KEYWORDS.items():
        if key in text and code not in found:
            found.append(code)
            if len(found) >= max_count:
                break
    return found


def _related_quotes_for_news(article: dict):
    codes = _extract_related_stock_codes(article.get('title') or '', article.get('summary') or '')
    if not codes:
        return []
    snap = {}
    if fetch_live_snapshot_batch:
        try:
            snap = fetch_live_snapshot_batch(codes) or {}
        except Exception:
            snap = {}
    rows = []
    for code in codes:
        name = PRICE_STOCKS.get(code) or code
        row = snap.get(code) or {}
        price, rate, direction = _effective_quote_for_mock(code, row)
        if price <= 0:
            continue
        rows.append({
            'code': code,
            'name': name,
            'price': int(price),
            'change_rate': round(float(rate or 0.0), 2),
            'direction': direction or 'flat',
        })
    return rows

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """종목 분석 API 엔드포인트"""
    data = request.json
    stock_name = data.get('stock_name', '').strip()
    
    if not stock_name:
        return jsonify({'success': False, 'message': '종목명을 입력해주세요.'}), 400
    
    result = analyze_stock(stock_name)
    return jsonify(result)


@app.route('/api/terms/explain', methods=['POST'])
def explain_term():
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
        'answer': gpt_result.get('text', '').strip()
    })


@app.route('/api/rss/news', methods=['GET'])
def rss_news():
    """RSS 뉴스 프록시 API"""
    try:
        limit = int(request.args.get('limit', '12'))
    except ValueError:
        limit = 12

    limit = max(1, min(limit, 30))
    result = fetch_rss_items(limit=limit)

    if not result.get('success'):
        return jsonify({'success': False, 'message': result.get('message', 'RSS 조회 실패')}), 502

    return jsonify({
        'success': True,
        'items': result.get('items', []),
        'feed': result.get('feed', ''),
        'from_db': result.get('from_db', False),
    })


@app.route('/api/news/<int:news_id>', methods=['GET'])
def news_detail(news_id: int):
    """단일 뉴스(본문 요약 + 선택 시 AI 쉬운 설명 생성/캐시)."""
    want_digest = (request.args.get('digest') or '').strip().lower() in ('1', 'true', 'y', 'yes', 'on')
    try:
        conn = get_db_connection()
        try:
            article = news_service.fetch_article_by_id(conn, news_id)
        finally:
            conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': f'DB 오류: {e}'}), 500

    if not article:
        return jsonify({'success': False, 'message': '기사를 찾을 수 없습니다.'}), 404

    if want_digest and NEWS_READER_DIGEST and GPT_AVAILABLE:
        if not (article.get('reader_digest') or '').strip():
            gen = _explain_news_reader_text(article.get('title') or '', article.get('summary') or '')
            if gen.get('success') and (gen.get('text') or '').strip():
                digest_text = gen['text'].strip()
                article['reader_digest'] = digest_text
                try:
                    conn = get_db_connection()
                    try:
                        news_service.update_reader_digest(conn, news_id, digest_text)
                        conn.commit()
                    except Exception as ex:
                        conn.rollback()
                        print(f'[news] reader_digest 저장 실패: {ex}')
                    finally:
                        conn.close()
                except Exception as ex:
                    print(f'[news] reader_digest DB 연결 실패: {ex}')
            else:
                article['digest_error'] = gen.get('message') or '설명 생성에 실패했습니다.'
    elif want_digest and NEWS_READER_DIGEST and not GPT_AVAILABLE:
        article['digest_error'] = 'AI 설명을 쓰려면 OPENAI_API_KEY 또는 GPT_API_KEY를 설정하세요.'

    return jsonify({'success': True, 'article': article, 'related_quotes': _related_quotes_for_news(article)})


@app.route('/api/mock/traded-value-rank', methods=['GET'])
def mock_traded_value_rank():
    """모의투자용 종목 목록(거래대금 순)."""
    try:
        limit = int(request.args.get('limit', '30'))
    except ValueError:
        limit = 30
    limit = max(1, min(50, limit))

    if not PRICE_STOCKS:
        return jsonify({'success': True, 'items': []})

    codes = [c for c, _ in list(PRICE_STOCKS.items())[: min(80, _WEB_PRICE_MAX_COUNT * 2)]]
    snap = {}
    if fetch_live_snapshot_batch:
        try:
            snap = fetch_live_snapshot_batch(codes) or {}
        except Exception:
            snap = {}

    vol_map = {}
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
                    SELECT s.symbol, COALESCE(sp.volume, 0) AS v
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
    for code, name in PRICE_STOCKS.items():
        if code not in codes:
            continue
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
        items.append({
            'code': code,
            'name': name,
            'price': price,
            'change_rate': round(rate, 2),
            'direction': direction,
            'volume': vol,
            'traded_value': int(traded_value),
        })

    items.sort(key=lambda x: -x['traded_value'])
    try:
        token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None
        nudge = [(c, name) for c, name in PRICE_STOCKS.items() if c in codes][: min(_WEB_REFRESH_BATCH_SIZE, len(codes))]
        if nudge:
            _start_live_refresh(nudge, token, force=False)
    except Exception:
        pass

    return jsonify({'success': True, 'items': items[:limit]})


@app.route('/api/mock/asking-price/<code>', methods=['GET'])
def mock_asking_price(code):
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


@app.route('/api/mock/portfolio', methods=['GET'])
def mock_portfolio():
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

            cursor.execute(
                """
                SELECT
                    vo.order_id,
                    vo.side,
                    vo.price,
                    vo.quantity,
                    vo.status,
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
            normalized_orders.append({
                'order_id': row.get('order_id'),
                'side': row.get('side'),
                'price': price,
                'quantity': qty,
                'total': price * qty,
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


@app.route('/api/mock/trade', methods=['POST'])
def mock_trade():
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
            if side == 'BUY':
                if cash_balance < total_amount:
                    return jsonify({'success': False, 'message': '잔액이 부족합니다.'}), 400
                cursor.execute(
                    """
                    UPDATE virtual_accounts
                    SET cash_balance = cash_balance - %s, updated_at = NOW()
                    WHERE account_id = %s
                    """,
                    (total_amount, account_id),
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

                cursor.execute(
                    """
                    UPDATE virtual_accounts
                    SET cash_balance = cash_balance + %s, updated_at = NOW()
                    WHERE account_id = %s
                    """,
                    (total_amount, account_id),
                )
                remain = current_qty - quantity
                if remain > 0:
                    cursor.execute(
                        "UPDATE virtual_positions SET quantity = %s, updated_at = NOW() WHERE position_id = %s",
                        (remain, pos['position_id']),
                    )
                else:
                    cursor.execute("DELETE FROM virtual_positions WHERE position_id = %s", (pos['position_id'],))

            cursor.execute(
                """
                INSERT INTO virtual_orders (
                    account_id, stock_id, side, price, quantity, status, fee_amount, executed_at, created_at
                ) VALUES (%s, %s, %s, %s, %s, 'EXECUTED', 0, NOW(), NOW())
                """,
                (account_id, stock_id, side, price, quantity),
            )
        conn.commit()

        cash_after = cash_before - total_amount if side == 'BUY' else cash_before + total_amount
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
                'total': total_amount,
                'fee': 0,
            },
        })
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': f'모의 주문 처리 실패: {e}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/health', methods=['GET'])
def health():
    """헬스 체크"""
    return jsonify({'status': 'ok', 'message': '서버가 정상 작동 중입니다.'}), 200


_INDEX_YF_TICKERS = {
    'KOSPI': '^KS11',
    'KOSDAQ': '^KQ11',
    'KOSPI 200': '^KS200',
}
_KIS_INDEX_ROWS_FIXED = [
    ('KOSPI', '0001'),
    ('KOSDAQ', '1001'),
    ('KOSPI 200', '2001'),
]
_KIS_INDEX_TR = os.getenv('KIS_INDEX_TR_ID', 'FHPUP02100000')
_KIS_INDEX_TR_FB = os.getenv('KIS_INDEX_TR_ID_MOCK', 'VFPUP02100000')
_INDEX_CACHE = {'data': [], 'ts': 0.0}
_INDEX_CACHE_TTL = int(os.getenv('MARKET_INDICES_CACHE_TTL_SEC', '15'))

_FX_USD_KRW_CACHE = {'payload': None, 'ts': 0.0}
_FX_USD_KRW_TTL = float(os.getenv('FX_USD_KRW_CACHE_TTL_SEC', '30'))


def _kis_index_price_fields(out):
    """KIS 지수 API 필드 추출."""
    if not out:
        return None, None, None
    pr = out.get('bstp_nmix_prpr') or out.get('BSTP_NMIX_PRPR')
    dv = out.get('bstp_nmix_prdy_vrss') or out.get('BSTP_NMIX_PRDY_VRSS')
    rt = out.get('bstp_nmix_prdy_ctrt') or out.get('BSTP_NMIX_PRDY_CTRT')
    return pr, dv, rt


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


def _yf_index_from_ticker(name, ticker):
    """Yahoo Finance 지수 일봉."""
    hist = yf.Ticker(ticker).history(period='30d', interval='1d')
    closes = hist['Close'].dropna() if hist is not None and not hist.empty else None
    if closes is None or len(closes) < 2:
        raise ValueError('데이터 없음')
    curr_close = float(closes.iloc[-1])
    prev_close = float(closes.iloc[-2])

    change_abs = curr_close - prev_close
    change_pct = (change_abs / prev_close * 100) if prev_close else 0.0
    direction = 'up' if change_abs > 0 else ('down' if change_abs < 0 else 'flat')
    return {
        'name': name,
        'value': round(curr_close, 2),
        'change_abs': round(change_abs, 2),
        'change_pct': round(change_pct, 2),
        'direction': direction,
        'source': 'yfinance',
    }


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


@app.route('/api/market-indices', methods=['GET'])
def market_indices():
    """주요 시장 지수 (캐시)."""
    now = time.time()
    if now - _INDEX_CACHE['ts'] < _INDEX_CACHE_TTL and _INDEX_CACHE['data']:
        return jsonify({'success': True, 'indices': _INDEX_CACHE['data'],
                        'cached': True, 'ts': datetime.fromtimestamp(_INDEX_CACHE['ts']).strftime('%H:%M:%S')})

    result = []
    token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None

    if token:
        for i, (name, fid) in enumerate(_KIS_INDEX_ROWS_FIXED):
            if i > 0 and _WEB_REQUEST_GAP_SEC > 0:
                time.sleep(min(_WEB_REQUEST_GAP_SEC, 0.25))
            out, _err = _kis_fetch_index_price(token, fid)
            if out:
                try:
                    row = _kis_index_output_to_row(name, out)
                    if _kis_index_row_seems_valid(name, row.get('value')):
                        result.append(row)
                        continue
                except Exception:
                    pass
            yft = _INDEX_YF_TICKERS.get(name)
            if yft:
                try:
                    result.append(_yf_index_from_ticker(name, yft))
                except Exception as e:
                    result.append({'name': name, 'error': str(e)})
            else:
                result.append({'name': name, 'error': _err or '조회 실패'})
    else:
        for name, yft in _INDEX_YF_TICKERS.items():
            try:
                result.append(_yf_index_from_ticker(name, yft))
            except Exception as e:
                result.append({'name': name, 'error': str(e)})

    _INDEX_CACHE['data'] = result
    _INDEX_CACHE['ts'] = now
    return jsonify({'success': True, 'indices': result, 'cached': False,
                    'ts': datetime.now().strftime('%H:%M:%S')})


@app.route('/api/fx-usd-krw', methods=['GET'])
def fx_usd_krw():
    """USD/KRW 환율."""
    now = time.time()
    cached = _FX_USD_KRW_CACHE['payload']
    if cached and (now - _FX_USD_KRW_CACHE['ts']) < _FX_USD_KRW_TTL:
        return jsonify({
            'success': True,
            **cached,
            'cached': True,
            'ts': datetime.fromtimestamp(_FX_USD_KRW_CACHE['ts']).strftime('%H:%M:%S'),
        })

    try:
        hist = yf.Ticker('KRW=X').history(period='5d')
        if hist is None or hist.empty:
            return jsonify({'success': False, 'message': '환율 데이터 없음'}), 404
        closes = hist['Close'].dropna()
        if closes.empty:
            return jsonify({'success': False, 'message': '환율 데이터 없음'}), 404
        curr = float(closes.iloc[-1])
        prev = float(closes.iloc[-2]) if len(closes) >= 2 else curr
        change_abs = curr - prev
        change_pct = (change_abs / prev * 100) if prev else 0.0
        direction = 'up' if change_abs > 0 else ('down' if change_abs < 0 else 'flat')
        payload = {
            'name': 'USD/KRW',
            'value': round(curr, 2),
            'change_abs': round(change_abs, 2),
            'change_pct': round(change_pct, 2),
            'direction': direction,
            'source': 'yfinance',
        }
        _FX_USD_KRW_CACHE['payload'] = payload
        _FX_USD_KRW_CACHE['ts'] = now
        return jsonify({
            'success': True,
            **payload,
            'cached': False,
            'ts': datetime.now().strftime('%H:%M:%S'),
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 502


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


def _clip_hist_to_requested_range(hist: pd.DataFrame, range_param: str, intraday: bool) -> pd.DataFrame:
    """fallback으로 더 긴 기간을 받아도 요청 구간에 맞게 절단."""
    if hist is None or getattr(hist, 'empty', True):
        return hist
    rp = str(range_param or '').strip().lower()

    if intraday and rp == '1d':
        return _trim_intraday_to_last_session_day(hist)

    # 1d + 일봉 폴백: yfinance가 5d/1mo 일봉을 주면 그대로 두면 '1일'인데 한 달 칼이 됨 → 마지막 거래일 1봉만
    if rp == '1d' and not intraday:
        try:
            return hist.iloc[-1:].copy()
        except Exception:
            return hist

    keep_days_map = {
        '1w': 8,
        '1m': 32,
        '1y': 370,
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


@app.route('/api/chart-data/<code>', methods=['GET'])
def chart_data(code):
    """종목 차트 (yfinance)."""
    range_param = str(request.args.get('range', '1d') or '1d').strip().lower()
    if range_param not in ('1d', '1w', '1m', '1y'):
        range_param = '1d'

    range_attempts = {
        '1d': [
            ('1d', '5m', True, False),
            ('2d', '5m', True, True),
            ('5d', '5m', True, True),
            ('1d', '15m', True, False),
            ('2d', '15m', True, True),
            ('5d', '15m', True, True),
            ('5d', '60m', True, True),
            ('2d', '1d', False, False),
            ('5d', '1d', False, False),
            ('1mo', '1d', False, False),
        ],
        '1w': [('5d', '1d', False, False), ('7d', '1d', False, False), ('1mo', '1d', False, False)],
        '1m': [('1mo', '1d', False, False), ('3mo', '1d', False, False)],
        '1y': [('1y', '1d', False, False), ('2y', '1d', False, False)],
    }
    attempts = range_attempts.get(range_param, [('1d', '5m', True, False)])

    for ticker_code in _candidate_yahoo_tickers(code):
        for period, interval, intraday, trim_last in attempts:
            try:
                hist = yf.Ticker(ticker_code).history(
                    period=period, interval=interval, auto_adjust=False, actions=False
                )
                if hist.empty:
                    continue
                if intraday and trim_last:
                    hist = _trim_intraday_to_last_session_day(hist)
                hist = _clip_hist_to_requested_range(hist, range_param, intraday)
                if hist.empty:
                    continue
                payload = _build_chart_payload_from_hist(hist, intraday)
                if not payload:
                    continue
                payload['code'] = code
                payload['requested_range'] = range_param
                return jsonify(payload)
            except Exception:
                continue

    return jsonify({'success': False, 'message': '차트 데이터를 불러올 수 없습니다.'}), 404


_KIS_KEY    = os.getenv('KIS_APP_KEY')
_KIS_SECRET = os.getenv('KIS_APP_SECRET')
_KIS_PROD   = os.getenv('KIS_USE_PROD', 'false').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_KIS_BASE   = 'https://openapi.koreainvestment.com:9443' if _KIS_PROD else 'https://openapivts.koreainvestment.com:29443'
_KIS_TR     = 'FHKST01010100' if _KIS_PROD else 'VFHKST01010100'
_KIS_TR_FB  = 'VFHKST01010100' if _KIS_PROD else 'FHKST01010100'
_KIS_TR_ASK = 'FHKST01010200' if _KIS_PROD else 'VFHKST01010200'
_KIS_TR_ASK_FB = 'VFHKST01010200' if _KIS_PROD else 'FHKST01010200'
_KIS_TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'token_vts.json')
# 호가 API: KIS 초당 호출 제한 대응 (캐시·전역 직렬화·stale 폴백)
_ASKING_PRICE_CACHE = {}
_ASKING_PRICE_CACHE_LOCK = threading.Lock()
_ASKING_PRICE_CACHE_TTL = float(os.getenv('MOCK_ASKING_CACHE_TTL_SEC', '15'))
_ASKING_STALE_FALLBACK_SEC = float(os.getenv('MOCK_ASKING_STALE_FALLBACK_SEC', '180'))
_ASKING_FETCH_SERIAL_LOCK = threading.Lock()
_KIS_ASKING_SKIP_FB = os.getenv('KIS_ASKING_SKIP_FALLBACK_TR', 'false').strip().lower() in {
    '1', 'true', 'y', 'yes', 'on',
}
_KIS_ASKING_GAP_LOCK = threading.Lock()
_KIS_ASKING_LAST_CALL = 0.0
_KIS_ASKING_MIN_GAP = float(os.getenv('KIS_ASKING_MIN_GAP_SEC', '1.0'))
_KIS_ASKING_SECOND_TR_GAP = float(os.getenv('KIS_ASKING_SECOND_TR_GAP_SEC', '1.15'))
_WEB_PRICE_MAX_COUNT = int(os.getenv('LIVE_PRICE_MAX_COUNT', '50'))
_WEB_REQUEST_GAP_SEC = float(os.getenv('LIVE_PRICE_REQUEST_GAP_SEC', '0.35'))
_WEB_REFRESH_BATCH_SIZE = int(os.getenv('LIVE_PRICE_REFRESH_BATCH_SIZE', '10'))
_WEB_WARMUP_BATCH_SIZE = int(os.getenv('LIVE_PRICE_WARMUP_BATCH_SIZE', '20'))
_WEB_UPDATE_INTERVAL_SEC = float(os.getenv('LIVE_PRICE_UPDATE_INTERVAL_SEC', '0.9'))
_LIVE_PRICE_DB_SYNC_ENABLED = os.getenv('LIVE_PRICE_DB_SYNC_ENABLED', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_LIVE_BG_ENABLED = os.getenv('LIVE_PRICE_BG_ENABLED', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_LIVE_BG_INTERVAL_SEC = float(os.getenv('LIVE_PRICE_BG_INTERVAL_SEC', '2.0'))
_LIVE_BLOCK_OFFHOURS_FETCH = os.getenv('LIVE_PRICE_BLOCK_OFFHOURS_FETCH', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_KR_MARKET_OPEN_HHMM = int(os.getenv('KR_MARKET_OPEN_HHMM', '900'))
_KR_MARKET_CLOSE_HHMM = int(os.getenv('KR_MARKET_CLOSE_HHMM', '1530'))
_MOCK_INITIAL_CASH = int(float(os.getenv('MOCK_INITIAL_CASH', '1000000')))

if PRICE_STOCKS:
    LIVE_PRICE_STOCKS = dict(list(PRICE_STOCKS.items())[:_WEB_PRICE_MAX_COUNT])
else:
    LIVE_PRICE_STOCKS = {
        '005930': '삼성전자',
        '000660': 'SK하이닉스',
        '035420': 'NAVER',
    }

_LIVE_PRICE_CACHE = {}
_LIVE_PRICE_CURSOR = 0
_LIVE_PRICE_LOCK = threading.Lock()
_LIVE_UPDATER_RUNNING = False
_LIVE_LAST_UPDATE_AT = 0.0
_LIVE_BG_WORKER_STARTED = False
_SECTOR_FULL_REFRESH_GUARD = threading.Lock()
_KIS_TOKEN_CACHE = None
_KIS_TOKEN_SAVED_AT = 0.0
_STOCK_DETAIL_CACHE = {}
_STOCK_DETAIL_CACHE_TTL = 60.0
_BASIC_PEER_CACHE = {}
_BASIC_PEER_CACHE_TTL = 3600.0
_INVESTOR_FLOW_CACHE = {}
_INVESTOR_FLOW_CACHE_TTL = 120.0


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


def _is_kr_regular_market_open_now():
    """한국 정규장(평일 09:00~15:30) 기준."""
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    hhmm = now.hour * 100 + now.minute
    return _KR_MARKET_OPEN_HHMM <= hhmm <= _KR_MARKET_CLOSE_HHMM


def _live_fetch_enabled_now():
    if not _LIVE_BLOCK_OFFHOURS_FETCH:
        return True
    return _is_kr_regular_market_open_now()


def _kis_fetch_allowed_now():
    """정규장에서만 KIS 실시간 시세 호출(장외·주말은 TPS·정책 절약). yfinance·DB 동기화는 별도."""
    return _live_fetch_enabled_now()


def _candidate_yahoo_tickers(code):
    if '.' in code:
        return [code]
    return [f'{code}.KS', f'{code}.KQ']


def _to_int(value):
    try:
        return int((value or '').replace(',', '').strip())
    except ValueError:
        return 0


def _to_float(value):
    try:
        return float((value or '').replace(',', '').strip())
    except ValueError:
        return 0.0


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


def _safe_round(value, digits=2):
    if value in (None, '', 'N/A'):
        return None
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return None


def _format_period_label(value):
    if hasattr(value, 'strftime'):
        return value.strftime('%Y-%m')
    return str(value)


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


def _build_news_items(ticker, limit=6):
    items = []
    try:
        raw_items = getattr(ticker, 'news', None) or []
    except Exception:
        raw_items = []

    for raw in raw_items[:limit]:
        content = raw.get('content', {}) if isinstance(raw, dict) else {}
        canonical = content.get('canonicalUrl') or {}
        provider = content.get('provider') or {}
        items.append({
            'title': content.get('title') or '제목 없음',
            'summary': content.get('summary') or content.get('description') or '',
            'published_at': content.get('pubDate') or content.get('displayTime') or '',
            'source': provider.get('displayName') or '',
            'url': canonical.get('url') or '',
        })
    return items


def _build_investor_flow_payload(code):
    cached = _INVESTOR_FLOW_CACHE.get(code)
    if cached and (time.time() - cached['ts'] < _INVESTOR_FLOW_CACHE_TTL):
        return cached['data']

    if pykrx_stock is None:
        data = {'available': False, 'source': 'pykrx 미사용', 'updated_at': '', 'items': []}
        _INVESTOR_FLOW_CACHE[code] = {'ts': time.time(), 'data': data}
        return data

    end = datetime.now().strftime('%Y%m%d')
    start = (datetime.now() - timedelta(days=10)).strftime('%Y%m%d')
    try:
        df = pykrx_stock.get_market_trading_value_by_date(start, end, code)
    except Exception:
        df = None

    if df is None or getattr(df, 'empty', True):
        data = {'available': False, 'source': '투자자 동향 데이터 없음', 'updated_at': '', 'items': []}
        _INVESTOR_FLOW_CACHE[code] = {'ts': time.time(), 'data': data}
        return data

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
        data = {'available': False, 'source': '투자자 동향 컬럼 없음', 'updated_at': '', 'items': []}
        _INVESTOR_FLOW_CACHE[code] = {'ts': time.time(), 'data': data}
        return data

    data = {
        'available': True,
        'source': 'pykrx',
        'updated_at': _format_period_label(df.index[-1]),
        'items': items,
    }
    _INVESTOR_FLOW_CACHE[code] = {'ts': time.time(), 'data': data}
    return data


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


def _build_stock_payload(code, name, output):
    sign = output.get('prdy_vrss_sign', '3')  # 1:상한 2:상승 3:보합 4:하한 5:하락
    direction = 'up' if sign in ('1', '2') else 'down' if sign in ('4', '5') else 'flat'
    change_abs = _to_int(output.get('prdy_vrss'))
    change_signed = change_abs if direction == 'up' else -change_abs
    rate_abs = _to_float(output.get('prdy_ctrt'))
    rate_signed = rate_abs if direction == 'up' else -rate_abs

    return {
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
        'traded_value': _to_int(output.get('acml_tr_pbmn')),
        'per': _safe_round(output.get('per')),
        'pbr': _safe_round(output.get('pbr')),
        'roe': None,
        'psr': None,
        'foreign_ownership_rate': _normalize_percent(output.get('frgn_hldn_rt')),
        'direction': direction,
        'stale': False,
        'error': None,
    }


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

    return {
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


def _build_stock_detail_payload(code, name, token):
    quote, kis_output, err = _fetch_quote_snapshot(code, name, token)
    if quote is None:
        raise ValueError(err or '상세 시세 조회 실패')

    ticker = None
    info = {}
    quarterly_financials = pd.DataFrame()
    quarterly_balance_sheet = pd.DataFrame()
    annual_balance_sheet = pd.DataFrame()
    annual_cashflow = pd.DataFrame()
    try:
        for ticker_code in _candidate_yahoo_tickers(code):
            ticker = yf.Ticker(ticker_code)
            info = ticker.info or {}
            quarterly_financials = ticker.quarterly_financials
            quarterly_balance_sheet = ticker.quarterly_balance_sheet
            annual_balance_sheet = ticker.balance_sheet
            annual_cashflow = ticker.cashflow
            break
    except Exception:
        ticker = None
        info = {}

    market_cap = _safe_round(info.get('marketCap'), 0)
    if market_cap is None and kis_output:
        market_cap = _safe_round(kis_output.get('hts_avls'), 0)
    dividend_yield = _normalize_percent(info.get('dividendYield'))
    if dividend_yield is None:
        dividend_yield = _normalize_percent(kis_output.get('divi') if kis_output else None)

    per = quote.get('per') if quote.get('per') is not None else _safe_round(info.get('trailingPE'))
    pbr = quote.get('pbr') if quote.get('pbr') is not None else _safe_round(info.get('priceToBook'))
    roe = _normalize_percent(info.get('returnOnEquity'))
    psr = _safe_round(info.get('priceToSalesTrailing12Months'))
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
        'investor_flows': _build_investor_flow_payload(code),
        'news': _build_news_items(ticker) if ticker is not None else [],
        'disclosures': [],
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


@app.route('/api/stock-detail/<code>', methods=['GET'])
def stock_detail(code):
    name = request.args.get('name') or LIVE_PRICE_STOCKS.get(code) or PRICE_STOCKS.get(code) or code
    cache_key = f'{code}:{name}'
    cached = _STOCK_DETAIL_CACHE.get(cache_key)
    if cached and (time.time() - cached['ts'] < _STOCK_DETAIL_CACHE_TTL):
        return jsonify({'success': True, 'cached': True, 'ts': cached['clock'], 'detail': cached['data']})

    token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None
    try:
        detail = _build_stock_detail_payload(code, name, token)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

    clock = time.strftime('%H:%M:%S')
    _STOCK_DETAIL_CACHE[cache_key] = {'ts': time.time(), 'clock': clock, 'data': detail}
    return jsonify({'success': True, 'cached': False, 'ts': clock, 'detail': detail})


def _kis_get_token():
    global _KIS_TOKEN_CACHE, _KIS_TOKEN_SAVED_AT

    if _KIS_TOKEN_CACHE and (time.time() - _KIS_TOKEN_SAVED_AT < 18000):
        return _KIS_TOKEN_CACHE

    if os.path.exists(_KIS_TOKEN_FILE):
        with open(_KIS_TOKEN_FILE) as f:
            d = json.load(f)
        if time.time() - d.get('saved_at', 0) < 18000:
            _KIS_TOKEN_CACHE = d.get('access_token')
            _KIS_TOKEN_SAVED_AT = d.get('saved_at', time.time())
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
                return token
    except Exception:
        pass
    return None


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


def _live_price_background_loop():
    """시세 백그라운드 폴링."""
    while True:
        try:
            items = list(LIVE_PRICE_STOCKS.items())[:_WEB_PRICE_MAX_COUNT]
            token = _kis_get_token() if (_KIS_KEY and _KIS_SECRET) else None
            _start_live_refresh(items, token, force=True)
        except Exception as e:
            print(f'[LIVE_BG] 갱신 루프 오류: {e}')
        time.sleep(max(1.0, _LIVE_BG_INTERVAL_SEC))


def _ensure_live_price_background_worker():
    """시세 백그라운드 워커 1회 시작."""
    global _LIVE_BG_WORKER_STARTED
    if not _LIVE_BG_ENABLED or _LIVE_BG_WORKER_STARTED:
        return

    if app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return

    _LIVE_BG_WORKER_STARTED = True
    t = threading.Thread(target=_live_price_background_loop, daemon=True)
    t.start()


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


@app.route('/api/live-prices', methods=['GET'])
def live_prices():
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
    if price_filter not in ('all', 'up', 'down'):
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
        all_items = list(LIVE_PRICE_STOCKS.items())[:_WEB_PRICE_MAX_COUNT]

    if custom_codes_raw:
        price_filter = 'all'

    universe_count = len(all_items)
    if universe_count == 0:
        return jsonify({'success': True, 'count': 0, 'stocks': [], 'ts': time.strftime('%H:%M:%S')})

    market_open = _live_fetch_enabled_now()
    if not market_open:
        # 장외에는 캐시 변동을 배제하고 DB 스냅샷만 반환(고정값 보장)
        snapshot = {}
        if fetch_live_snapshot_batch:
            snapshot = fetch_live_snapshot_batch([c for c, _ in all_items]) or {}

        full_rows = []
        for code, name in all_items:
            row = snapshot.get(code)
            if row:
                full_rows.append({**row, 'name': name})
            else:
                full_rows.append({'code': code, 'name': name, 'loading': True})

        if price_filter in ('up', 'down'):
            filtered_rows = [
                r for r in full_rows
                if (not r.get('loading')) and ((r.get('direction') or 'flat') == price_filter)
            ]
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


@app.route('/', defaults={'filename': '주린닷컴홈피.html'})
@app.route('/<path:filename>')
def serve_capstone(filename):
    """frontend 정적 파일."""
    if not filename or '..' in filename:
        abort(404)
    safe = os.path.normpath(filename).replace('\\', '/')
    if safe.startswith('..'):
        abort(404)
    full = os.path.abspath(os.path.join(_FRONTEND_DIR, safe))
    if not full.startswith(_FRONTEND_DIR + os.sep) and full != _FRONTEND_DIR:
        abort(404)
    if not os.path.isfile(full):
        abort(404)
    directory, basename = os.path.split(full)
    return send_from_directory(directory, basename)


if __name__ == '__main__':
    _ensure_live_price_background_worker()
    print('Server: http://127.0.0.1:5000')
    app.run(debug=True, port=5000)
