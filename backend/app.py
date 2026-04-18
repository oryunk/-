from flask import Flask, request, jsonify
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import os
import time
import json
import threading
import requests
import subprocess
import sys
import atexit
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from google import genai

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

# ★ 수정: load_dotenv()를 auth_api import보다 반드시 먼저 호출해야 합니다.
#   기존 코드도 순서는 맞았으나, 일부 환경에서 auth_api.py가 캐시된 상태(이미 import된 상태)로
#   재사용될 경우 db_config가 빈 값으로 고정되는 문제가 있었습니다.
#   auth_api.py에서 db_config를 get_connection() 내부로 이동하여 이 문제를 근본 해결합니다.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
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

from auth_api import auth_bp

app.register_blueprint(auth_bp)


def _apply_cors_headers(response):
    origin = request.headers.get("Origin")
    response.headers.setdefault(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
    )
    response.headers.setdefault(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
    )
    if origin:
        try:
            origin.encode("latin-1")
        except UnicodeEncodeError:
            origin = None
    # file:// 로 열면 브라우저가 Origin: null 을 보냄
    # credentials: 'include' 요청은 Allow-Origin: * 을 허용하지 않으므로 null 그대로 반환
    if origin == "null":
        response.headers["Access-Control-Allow-Origin"] = "null"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    elif origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.after_request
def _cors_after_request(response):
    return _apply_cors_headers(response)


@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        return _apply_cors_headers(app.make_response(("", 204)))

# Gemini API 설정
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
FALLBACK_GEMINI_MODEL = 'gemini-2.0-flash'
try:
    if not GEMINI_API_KEY:
        raise ValueError('GEMINI_API_KEY is not set')
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    GEMINI_AVAILABLE = True
except Exception as e:
    print(f'[WARN] Gemini API 초기화 실패: {e}')
    gemini_client = None
    GEMINI_AVAILABLE = False

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

RSS_FEEDS = [
    'https://www.mk.co.kr/rss/50200011/'
]

MASTER_PROMPT = """[MASTER PROMPT] 스몰캡 전략 v7.4: 대화형 투자 분석 시스템 - Quantum Leap Hybrid Deep Analysis Edition

나의 역할
너는 Quantum Leap 팀 리더인 GEMINI이다.
너는 Harper, Benjamin, Lucas, Sophia와 함께 5명 팀으로 작동하며, 모든 분석은 팀원들의 전문 영역을 최대한 활용하면서 이전 단일 역할 프롬프트 수준 이상의 상세하고 깊은 분석을 제공한다. 불필요한 영어 출력은 제한하고, 최대한 적절한 한국어로 출력한다. 특히 용어 출력시 불필요하게 사용하지 않는다.

실제 팀 역할 분담
GEMINI (Team Leader): 전체 조율, 각 STAGE 종합, 추가 인사이트 보강, 최종 결론
Harper: Macro Sentinel (시장 국면, VIX, 매크로 환경, 메가트렌드 전문)
Benjamin: Fundamental Researcher + Risk Guardian (SEC 자료, 펀더멘털 체크리스트, Cash Runway·Dilution, Red Team, Kill Switch, 인지 편향 체크 전문)
Lucas: Technical Pattern Hunter (최신 차트 수집·패턴 분석, 상대강도, 시나리오 전문)

강화된 대화 프로토콜 (절대 준수)
분석은 반드시 STAGE별로 하나씩만 진행한다.
각 STAGE가 끝나면 반드시 다음을 출력한다:
해당 STAGE의 핵심 결론을 한 문장으로 명확히 제시
절대 한 번에 여러 STAGE를 한꺼번에 출력하지 않는다.

강화된 분석 원칙 (Hybrid Deep Mode)
각 에이전트는 분석 시 반드시 구체적인 숫자, 날짜, 경영진 코멘트 등을 최대한 포함하고, 논리를 자세히 풀어서 설명한다.
GEMINI는 각 STAGE 끝에 팀 의견 통합 + 추가 인사이트를 반드시 추가한다.

Kill Switch 프로토콜 v5.6
Hard Kill: Going Concern, 사기 의심 등 치명적 리스크 → 즉시 중단
Soft Warning: Cash Runway <6개월, Dilution >25% 등 → Override 여부 사용자에게 질문

STAGE 0: 시장 국면 분석 (Harper 주도)
- 시장 심리, VIX 수준, 매크로 환경 분석, 주요 지수 전술 위치, 시장 등급(A+/B/F) 판정

STAGE 1: 메가트렌드 식별 (Harper 주도)

STAGE 2: 미래의 주도주 통합 분석 (Benjamin 주도)

STAGE 3: 장기 차트 셋업 및 시나리오 분석 (Lucas 주도)

STAGE 4: 포지션 구축 실행 계획 (GEMINI 종합)

STAGE 5: 최종 투자 논거 요약 (GEMINI 종합)

STAGE 6: 인지 편향 체크 (Benjamin 주도) → PASS / HOLD / REJECT
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

def call_gemini(prompt_text, model=DEFAULT_GEMINI_MODEL):
    if not GEMINI_AVAILABLE or gemini_client is None:
        return {
            'success': False,
            'status_code': 500,
            'message': 'Gemini API가 설정되지 않았습니다. GEMINI_API_KEY를 확인해주세요.'
        }

    model_candidates = [model]
    if model != FALLBACK_GEMINI_MODEL:
        model_candidates.append(FALLBACK_GEMINI_MODEL)

    last_error = None
    for model_name in model_candidates:
        for attempt in range(3):
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt_text
                )
                return {'success': True, 'text': response.text}
            except Exception as err:
                last_error = str(err)
                is_unavailable = ('503' in last_error) or ('UNAVAILABLE' in last_error.upper())
                print(f'[Gemini] 호출 실패(model={model_name}, attempt={attempt + 1}): {last_error}')
                if is_unavailable and attempt < 2:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                break

    if last_error and (('429' in last_error) or ('RESOURCE_EXHAUSTED' in last_error.upper()) or ('QUOTA' in last_error.upper())):
        status_code = 429
    elif last_error and (('503' in last_error) or ('UNAVAILABLE' in last_error.upper())):
        status_code = 503
    else:
        status_code = 500
    return {'success': False, 'status_code': status_code, 'message': last_error or 'Gemini 호출에 실패했습니다.'}

def get_stock_data(stock_name):
    """주식 데이터 조회"""
    try:
        # 한글 이름으로 조회 시 코드로 변환
        if stock_name in STOCK_CODES:
            ticker = STOCK_CODES[stock_name]
        else:
            ticker = stock_name
        
        # 최근 3개월 데이터 조회
        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)
        
        data = yf.download(ticker, start=start_date, end=end_date, progress=False)
        
        if data.empty:
            return None
        
        return data
    except Exception as e:
        print(f"데이터 조회 오류: {e}")
        return None

def analyze_stock(stock_name):
    """AI 종목 분석"""
    data = get_stock_data(stock_name)
    
    if data is None:
        return {
            'success': False,
            'message': '종목 데이터를 불러올 수 없습니다.'
        }
    
    try:
        # 기본 통계
        current_price = float(data['Close'].iloc[-1])
        prev_price = float(data['Close'].iloc[-5]) if len(data) >= 5 else float(data['Close'].iloc[0])
        change_rate = ((current_price - prev_price) / prev_price * 100) if prev_price != 0 else 0
        
        # 이동평균선
        ma_20 = float(data['Close'].rolling(window=20).mean().iloc[-1])
        ma_60 = float(data['Close'].rolling(window=60).mean().iloc[-1])
        
        # 변동성
        volatility = float(data['Close'].pct_change().std() * 100)
        
        # 거래량 추세
        avg_volume = float(data['Volume'].rolling(window=20).mean().iloc[-1])
        current_volume = float(data['Volume'].iloc[-1])
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
        
        # 의견 결정
        if signals['bullish'] >= 2.5:
            opinion = "강력매수"
            color = "green"
        elif signals['bullish'] >= 1.5:
            opinion = "매수"
            color = "light-green"
        elif signals['bearish'] > signals['bullish']:
            opinion = "약세"
            color = "red"
        else:
            opinion = "보유"
            color = "gray"
        
        # 목표가 설정 (간단한 계산)
        target_price = current_price * (1 + change_rate/100 * 0.5)
        
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

        gemini_input = f"{MASTER_PROMPT}\n\n--------------------------------------------------\n[종목 데이터]\n종목: {stock_name}\n현재가: {current_price:,.0f}원\n변동률: {change_rate:+.2f}%\n20일 MA: {ma_20:,.0f}원\n60일 MA: {ma_60:,.0f}원\n변동성: {volatility:.2f}%\n거래량 추세: {volume_trend}\n댓글: {analysis_summary}\n\n[요청] 아래 STAGE 프로토콜에 따라 스몰캡 전략 v7.4 프레임으로 구조화된 투자 분석을 진행하라."

        gemini_result = call_gemini(gemini_input)
        gemini_text = gemini_result.get('text') if gemini_result.get('success') else f"Gemini 호출 실패: {gemini_result.get('message')}"

        return {
            'success': True,
            'stock_name': stock_name,
            'current_price': round(current_price, 0),
            'change_rate': round(change_rate, 2),
            'ma_20': round(ma_20, 0),
            'ma_60': round(ma_60, 0),
            'volatility': round(volatility, 2),
            'opinion': opinion,
            'target_price': round(target_price, 0),
            'summary': analysis_summary,
            'gemini_analysis': gemini_text,
            'color': color
        }
    
    except Exception as e:
        print(f"분석 오류: {e}")
        return {
            'success': False,
            'message': f'분석 중 오류가 발생했습니다: {str(e)}'
        }


def explain_term_with_gemini(term_name):
    """금융/투자 용어를 Gemini로 설명"""
    prompt = (
        f"{TERM_INTERPRETATION_PROMPT}\n"
        f"[사용자 질문]\n{term_name}\n\n"
        "위 질문은 단일 금융/투자 용어 질문이다. 답변 구조를 지켜 설명하라."
    )
    return call_gemini(prompt, model=DEFAULT_GEMINI_MODEL)


def fetch_rss_items(limit=12):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }

    for feed_url in RSS_FEEDS:
        try:
            response = requests.get(feed_url, headers=headers, timeout=10)
            response.raise_for_status()

            root = ET.fromstring(response.content)
            channel = root.find('channel')
            if channel is None:
                continue

            items = []
            for item in channel.findall('item')[:limit]:
                items.append({
                    'title': (item.findtext('title') or '제목 없음').strip(),
                    'description': (item.findtext('description') or '내용 없음').strip(),
                    'link': (item.findtext('link') or '').strip(),
                    'pubDate': (item.findtext('pubDate') or '').strip(),
                    'source': '매일경제',
                })

            if items:
                return {'success': True, 'items': items, 'feed': feed_url}
        except Exception as err:
            print(f'[RSS] 피드 로드 실패 ({feed_url}): {err}')

    return {'success': False, 'message': 'RSS 피드를 불러오지 못했습니다.'}

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

    gemini_result = explain_term_with_gemini(term)
    if not gemini_result.get('success'):
        status_code = gemini_result.get('status_code', 500)
        if status_code == 429:
            fallback_answer = explain_term_with_local_fallback(term)
            return jsonify({
                'success': True,
                'term': term,
                'answer': fallback_answer,
                'source': 'local-fallback',
                'notice': 'Gemini 쿼터 초과로 로컬 요약 답변을 제공했습니다.'
            })
        return jsonify({
            'success': False,
            'message': gemini_result.get('message', '용어 설명에 실패했습니다. 일시 후 다시 시도해주세요.')
        }), status_code

    return jsonify({
        'success': True,
        'term': term,
        'answer': gemini_result.get('text', '').strip()
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
    })


@app.route('/api/mock/traded-value-rank', methods=['GET'])
def mock_traded_value_rank():
    """모의투자용 거래대금 상위 종목 조회"""
    return jsonify({'success': False, 'message': '거래대금 순위 기능은 현재 지원되지 않습니다.'}), 501

@app.route('/api/health', methods=['GET'])
def health():
    """헬스 체크"""
    return jsonify({'status': 'ok', 'message': '서버가 정상 작동 중입니다.'}), 200


# ── 주요 시장 지수 ────────────────────────────────────────
_INDEX_TICKERS = [
    ('KOSPI',      '^KS11'),
    ('KOSDAQ',     '^KQ11'),
    ('KOSPI 200',  '^KS200'),
    ('KOSDAQ 150', '229200.KS'),
]
_INDEX_CACHE = {'data': [], 'ts': 0.0}
_INDEX_CACHE_TTL = 60  # 초


@app.route('/api/market-indices', methods=['GET'])
def market_indices():
    """주요 지수 실시간 조회 (yfinance, 60초 캐시)"""
    now = time.time()
    if now - _INDEX_CACHE['ts'] < _INDEX_CACHE_TTL and _INDEX_CACHE['data']:
        return jsonify({'success': True, 'indices': _INDEX_CACHE['data'],
                        'cached': True, 'ts': datetime.fromtimestamp(_INDEX_CACHE['ts']).strftime('%H:%M:%S')})

    result = []
    for name, ticker in _INDEX_TICKERS:
        try:
            hist = yf.Ticker(ticker).history(period='2d', interval='1d')
            if len(hist) >= 2:
                prev_close = float(hist['Close'].iloc[-2])
                curr_close = float(hist['Close'].iloc[-1])
            elif len(hist) == 1:
                prev_close = float(hist['Open'].iloc[-1])
                curr_close = float(hist['Close'].iloc[-1])
            else:
                raise ValueError('데이터 없음')

            change_abs = curr_close - prev_close
            change_pct = (change_abs / prev_close * 100) if prev_close else 0.0
            direction = 'up' if change_abs > 0 else ('down' if change_abs < 0 else 'flat')
            result.append({
                'name': name,
                'value': round(curr_close, 2),
                'change_abs': round(change_abs, 2),
                'change_pct': round(change_pct, 2),
                'direction': direction,
            })
        except Exception as e:
            result.append({'name': name, 'error': str(e)})

    _INDEX_CACHE['data'] = result
    _INDEX_CACHE['ts'] = now
    return jsonify({'success': True, 'indices': result, 'cached': False,
                    'ts': datetime.now().strftime('%H:%M:%S')})


@app.route('/api/chart-data/<code>', methods=['GET'])
def chart_data(code):
    """종목 차트 데이터 반환 (yfinance) - OHLC + MA"""
    range_param = request.args.get('range', '1d')

    range_map = {
        '1d': ('1d',  '5m'),
        '1w': ('5d',  '60m'),
        '1m': ('1mo', '1d'),
        '1y': ('1y',  '1d'),
    }
    period, interval = range_map.get(range_param, ('1d', '5m'))
    intraday = range_param == '1d'

    for ticker_code in _candidate_yahoo_tickers(code):
        try:
            hist = yf.Ticker(ticker_code).history(period=period, interval=interval)
            if hist.empty:
                continue

            candles = []
            for ts, row in hist.iterrows():
                o = row.get('Open');  h = row.get('High')
                l = row.get('Low');   c = row.get('Close')
                if pd.isna(o) or pd.isna(h) or pd.isna(l) or pd.isna(c):
                    continue
                time_val = int(ts.timestamp()) if intraday else ts.strftime('%Y-%m-%d')
                candles.append({
                    'time':  time_val,
                    'open':  round(float(o), 2),
                    'high':  round(float(h), 2),
                    'low':   round(float(l), 2),
                    'close': round(float(c), 2),
                })

            closes = [x['close'] for x in candles]
            ma5, ma20 = [], []
            for i in range(len(closes)):
                if i >= 4:
                    ma5.append({'time': candles[i]['time'], 'value': round(sum(closes[i-4:i+1]) / 5, 2)})
                if i >= 19:
                    ma20.append({'time': candles[i]['time'], 'value': round(sum(closes[i-19:i+1]) / 20, 2)})

            return jsonify({
                'success': True, 'candles': candles,
                'ma5': ma5, 'ma20': ma20,
                'code': code, 'intraday': intraday,
            })
        except Exception:
            continue

    return jsonify({'success': False, 'message': '차트 데이터를 불러올 수 없습니다.'}), 404


# ── KIS 실시간 시세 ─────────────────────────────────────────
_KIS_KEY    = os.getenv('KIS_APP_KEY')
_KIS_SECRET = os.getenv('KIS_APP_SECRET')
_KIS_PROD   = os.getenv('KIS_USE_PROD', 'false').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_KIS_BASE   = 'https://openapi.koreainvestment.com:9443' if _KIS_PROD else 'https://openapivts.koreainvestment.com:29443'
_KIS_TR     = 'FHKST01010100' if _KIS_PROD else 'VFHKST01010100'
_KIS_TR_FB  = 'VFHKST01010100' if _KIS_PROD else 'FHKST01010100'
_KIS_TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'token_vts.json')
_WEB_PRICE_MAX_COUNT = int(os.getenv('LIVE_PRICE_MAX_COUNT', '50'))
_WEB_REQUEST_GAP_SEC = float(os.getenv('LIVE_PRICE_REQUEST_GAP_SEC', '0.35'))
_WEB_REFRESH_BATCH_SIZE = int(os.getenv('LIVE_PRICE_REFRESH_BATCH_SIZE', '8'))
_WEB_WARMUP_BATCH_SIZE = int(os.getenv('LIVE_PRICE_WARMUP_BATCH_SIZE', '20'))
_WEB_UPDATE_INTERVAL_SEC = float(os.getenv('LIVE_PRICE_UPDATE_INTERVAL_SEC', '2.5'))

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
_KIS_TOKEN_CACHE = None
_KIS_TOKEN_SAVED_AT = 0.0
_STOCK_DETAIL_CACHE = {}
_STOCK_DETAIL_CACHE_TTL = 60.0
_BASIC_PEER_CACHE = {}
_BASIC_PEER_CACHE_TTL = 3600.0


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
    if pykrx_stock is None:
        return {'available': False, 'source': 'pykrx 미사용', 'updated_at': '', 'items': []}

    end = datetime.now().strftime('%Y%m%d')
    start = (datetime.now() - timedelta(days=10)).strftime('%Y%m%d')
    try:
        df = pykrx_stock.get_market_trading_value_by_date(start, end, code)
    except Exception:
        df = None

    if df is None or getattr(df, 'empty', True):
        return {'available': False, 'source': '투자자 동향 데이터 없음', 'updated_at': '', 'items': []}

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
        return {'available': False, 'source': '투자자 동향 컬럼 없음', 'updated_at': '', 'items': []}

    return {
        'available': True,
        'source': 'pykrx',
        'updated_at': _format_period_label(df.index[-1]),
        'items': items,
    }


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

    # 파일 I/O를 줄이기 위해 메모리 캐시를 우선 사용
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


def _refresh_live_cache(selected_items, token):
    """선택된 종목 일부를 순환 갱신한다. 별도 스레드에서 실행된다."""
    global _LIVE_PRICE_CURSOR, _LIVE_UPDATER_RUNNING, _LIVE_LAST_UPDATE_AT

    total = len(selected_items)
    if total == 0:
        with _LIVE_PRICE_LOCK:
            _LIVE_UPDATER_RUNNING = False
            _LIVE_LAST_UPDATE_AT = time.time()
        return

    with _LIVE_PRICE_LOCK:
        cached_count = sum(1 for code, _ in selected_items if code in _LIVE_PRICE_CACHE)
        refresh_count = _WEB_REFRESH_BATCH_SIZE
        if cached_count == 0:
            refresh_count = max(_WEB_WARMUP_BATCH_SIZE, _WEB_REFRESH_BATCH_SIZE)
        refresh_count = max(1, min(refresh_count, total))

        start = _LIVE_PRICE_CURSOR % total
        indices = [(start + i) % total for i in range(refresh_count)]
        _LIVE_PRICE_CURSOR = (start + refresh_count) % total

    for seq, idx in enumerate(indices):
        code, name = selected_items[idx]
        if seq > 0 and _WEB_REQUEST_GAP_SEC > 0:
            time.sleep(_WEB_REQUEST_GAP_SEC)

        payload = None
        err = None
        if token and _KIS_KEY and _KIS_SECRET:
            out = None
            for tr_id in (_KIS_TR, _KIS_TR_FB):
                out, err = _kis_fetch_one(token, code, tr_id)
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
            else:
                previous = _LIVE_PRICE_CACHE.get(code)
                if previous:
                    _LIVE_PRICE_CACHE[code] = {
                        **previous,
                        'name': name,
                        'stale': True,
                        # 이전 정상값이 있으면 화면은 유지하고 stale만 표시한다.
                        'error': None,
                    }
                else:
                    _LIVE_PRICE_CACHE[code] = {
                        'code': code,
                        'name': name,
                        'loading': True,
                        'error': err,
                    }

    with _LIVE_PRICE_LOCK:
        _LIVE_UPDATER_RUNNING = False
        _LIVE_LAST_UPDATE_AT = time.time()


@app.route('/api/live-prices', methods=['GET'])
def live_prices():
    """KIS API 실시간 시세 반환 (기본 50개, 배치 갱신 + 캐시)"""
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

    total_count = len(all_items)
    if total_count == 0:
        return jsonify({'success': True, 'count': 0, 'stocks': [], 'ts': time.strftime('%H:%M:%S')})

    total_pages = max(1, (total_count + page_size - 1) // page_size)
    if page > total_pages:
        page = total_pages

    start_index = (page - 1) * page_size
    end_index = min(start_index + page_size, total_count)
    selected_items = all_items[start_index:end_index]

    # 캐시 갱신은 백그라운드에서 수행하고 API는 즉시 캐시를 반환한다.
    with _LIVE_PRICE_LOCK:
        need_update = (not _LIVE_UPDATER_RUNNING) and (time.time() - _LIVE_LAST_UPDATE_AT >= _WEB_UPDATE_INTERVAL_SEC)
        if need_update:
            _LIVE_UPDATER_RUNNING = True
            t = threading.Thread(target=_refresh_live_cache, args=(selected_items, token), daemon=True)
            t.start()

        stocks = []
        for code, name in selected_items:
            cached = _LIVE_PRICE_CACHE.get(code)
            if cached:
                stocks.append({**cached, 'name': name})
            else:
                stocks.append({'code': code, 'name': name, 'loading': True})

        refresh_count = _WEB_REFRESH_BATCH_SIZE
        if all(s.get('loading') for s in stocks):
            refresh_count = max(_WEB_WARMUP_BATCH_SIZE, _WEB_REFRESH_BATCH_SIZE)

    return jsonify({
        'success': True,
        'count': len(stocks),
        'total_count': total_count,
        'total_pages': total_pages,
        'page': page,
        'page_size': page_size,
        'refresh_count': refresh_count,
        'stocks': stocks,
        'ts': time.strftime('%H:%M:%S')
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
