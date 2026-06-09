"""앱 전역 설정, 캐시, 락 (Flask·백그라운드 스레드가 공유하는 상태).

설명( Blueprint와 app.py가 import 하며, 환경변수·KIS/라이브 시세·차트 관련 상수가 모여 있다. )
"""
import os
import threading

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "..", "frontend"))

try:
    from price import STOCKS as PRICE_STOCKS
except Exception as price_err:
    print(f"[WARN] price.STOCKS 로드 실패: {price_err}")
    PRICE_STOCKS = {}


def _build_price_name_to_code(price_stocks: dict) -> dict:
    """price.STOCKS의 (코드→이름)을 이름·공백제거 이름 키로 역매핑한다."""
    out: dict = {}
    for code, name in (price_stocks or {}).items():
        nm = str(name or "").strip()
        if not nm:
            continue
        c = str(code).strip()
        out[nm.lower()] = c
        out[nm.replace(" ", "").lower()] = c
    return out

# GPT(OpenAI) API 설정
OPENAI_API_KEY = (os.getenv('OPENAI_API_KEY') or os.getenv('GPT_API_KEY') or '').strip()
DEFAULT_GPT_MODEL = os.getenv('GPT_MODEL', 'gpt-4o-mini').strip() or 'gpt-4o-mini'
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

_PRICE_NAME_TO_CODE = _build_price_name_to_code(PRICE_STOCKS)

RSS_FEEDS = [
    'https://www.mk.co.kr/rss/50200011/'
]

NEWS_DB_SYNC = os.getenv('NEWS_DB_SYNC', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
NEWS_READER_DIGEST = os.getenv('NEWS_READER_DIGEST', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_NEWS_STOCK_REL_SYNC = os.getenv('NEWS_STOCK_REL_SYNC', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_AI_ANALYSIS_PERSIST_DB = os.getenv('AI_ANALYSIS_PERSIST_DB', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_STOCK_POPULARITY_ON_ANALYSIS = os.getenv('STOCK_POPULARITY_ON_ANALYSIS', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}

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

TERM_INTERPRETATION_PROMPT = """주린이 투자자에게 질문한 금융·투자 용어 **하나만** 설명한다.

[작성 규칙]
- 한국어, 친한 멘토 말투. 전문 용어는 꼭 필요할 때만 짧게 쓴다.
- **반드시** 아래 [정의]·[설명] 두 블록만 출력한다. 다른 제목·굵은 꼬리표는 쓰지 않는다.

[정의]
- 1~2문장. 사전식으로 용어가 무엇인지만 간결히 적는다.

[설명]
- 2~3문단. 투자 맥락에서 왜 중요한지, 어떻게 쓰이는지, 주의할 점 등을 설명한다.
- [정의]에서 이미 쓴 내용을 반복하지 않는다.
- 비유·은유·일상 비교(예: "마치 ~처럼", "~에 비유하면")는 쓰지 않는다.
- 질문한 용어 외 다른 용어를 추가로 설명하지 않는다.
- 특정 종목 매수·매도를 권유하지 않는다.
"""

LOCAL_TERM_FALLBACK = {
    '현재가': (
        '1단계 학습: 시세 읽기 기초\n\n'
        '처음에는 어렵게 보이지만 핵심은 간단합니다. 시장(코스피·코스닥)과 가격 다섯 가지—'
        '시가, 현재가, 종가, 고가, 저가—만 먼저 익히면 됩니다.\n\n'
        '현재가는 지금 장에서 이 종목이 얼마에 거래되고 있는지 보여 주는 가격이에요. '
        '매수·매도 주문이 붙을 때마다 수시로 바뀔 수 있습니다.'
    ),
    'per': (
        'PER은 주가가 1주당 이익의 몇 배인지 나타내요. 같은 업종 기업끼리 비교해 '
        '“이익 대비 주가가 비싼 편인지”를 가늠할 때 씁니다. 성장 단계가 다르면 숫자만으로 판단하긴 어려워요.'
    ),
    'roe': (
        'ROE는 자기자본으로 얼마나 이익을 냈는지 보는 효율 지표예요. '
        '꾸준히 높으면 자본 활용이 나은 편이라고 볼 수 있지만, 부채가 많으면 왜곡될 수 있어 다른 표도 같이 봐야 해요.'
    ),
    'pbr': (
        'PBR은 주가가 장부상 순자산(1주당)의 몇 배인지예요. 자산 비중이 큰 업종에서 '
        '상대적 저·고평가를 볼 때 자주 씁니다.'
    ),
    'eps': (
        'EPS는 주 1주당 순이익이에요. PER을 계산할 때 분모로 쓰이고, 실적이 늘었는지 줄었는지 추이를 볼 때도 써요.'
    ),
    '배당주': (
        '배당주는 이익 일부를 배당금으로 주주에게 돌려주는 성향이 있는 주식을 가리키는 말로 쓰여요. '
        '시세차익과 함께 현금 흐름을 노릴 때 참고할 수 있어요.'
    ),
    '시가총액': (
        '시가총액은 주가에 발행 주식 수를 곱해 본 회사 규모(시장에서 매기는 가치)예요. '
        '대형·중형·소형주를 나눌 때 기준이 됩니다.'
    ),
    '변동성': (
        '변동성은 가격이 얼마나 크게 오르내리는지를 나타내요. 크면 기회도 있지만 손실 폭도 커질 수 있어요.'
    ),
    '포트폴리오': (
        '포트폴리오는 내가 가진 투자 자산의 조합이에요. 한 종목에 몰지 않고 나눠 담으면 리스크를 줄이는 데 도움이 됩니다.'
    ),
}
_INDEX_ROWS = [
    {'key': 'kospi', 'name': 'KOSPI', 'kis_code': '0001', 'yf_ticker': '^KS11',
     'region': 'KR', 'region_label': '한국', 'kind': 'index', 'interactive': True},
    {'key': 'kosdaq', 'name': 'KOSDAQ', 'kis_code': '1001', 'yf_ticker': '^KQ11',
     'region': 'KR', 'region_label': '한국', 'kind': 'index', 'interactive': True},
    {'key': 'kospi200', 'name': 'KOSPI 200', 'kis_code': '2001', 'yf_ticker': '^KS200',
     'region': 'KR', 'region_label': '한국', 'kind': 'index', 'interactive': True},
]
_GLOBAL_MACRO_ROWS = [
    {'key': 'sox', 'name': '필라델피아 반도체(SOX)', 'yf_ticker': '^SOX',
     'region': 'US', 'region_label': '미국', 'kind': 'index', 'interactive': True},
    {'key': 'nasdaq', 'name': '나스닥 종합', 'yf_ticker': '^IXIC',
     'region': 'US', 'region_label': '미국', 'kind': 'index', 'interactive': True},
    {'key': 'sp500', 'name': 'S&P 500', 'yf_ticker': '^GSPC',
     'region': 'US', 'region_label': '미국', 'kind': 'index', 'interactive': True},
    {'key': 'usdkrw', 'name': 'USD/KRW', 'yf_ticker': 'KRW=X',
     'region': 'KR', 'region_label': '환율', 'kind': 'fx', 'interactive': True},
    {'key': 'vix', 'name': 'VIX', 'yf_ticker': '^VIX',
     'region': 'US', 'region_label': '미국', 'kind': 'index', 'interactive': True},
    {'key': 'wti', 'name': 'WTI 유가', 'yf_ticker': 'CL=F',
     'region': 'GLOBAL', 'region_label': '국제', 'kind': 'commodity', 'interactive': True},
    {'key': 'copper', 'name': '구리', 'yf_ticker': 'HG=F',
     'region': 'GLOBAL', 'region_label': '국제', 'kind': 'commodity', 'interactive': True},
]
_ALL_INDEX_REGISTRY = _INDEX_ROWS + _GLOBAL_MACRO_ROWS
_INDEX_NAME_TO_KEY = {row['name']: row['key'] for row in _ALL_INDEX_REGISTRY}
_INDEX_KEY_TO_NAME = {row['key']: row['name'] for row in _ALL_INDEX_REGISTRY}
_INDEX_KEY_TO_YF_TICKER = {row['key']: row['yf_ticker'] for row in _ALL_INDEX_REGISTRY}
_INDEX_KEY_META = {
    row['key']: {
        'region': row.get('region', 'GLOBAL'),
        'region_label': row.get('region_label', ''),
        'kind': row.get('kind', 'index'),
        'interactive': bool(row.get('interactive', True)),
    }
    for row in _ALL_INDEX_REGISTRY
}
_INDEX_YF_TICKERS = {row['name']: row['yf_ticker'] for row in _INDEX_ROWS}
_TICKER_DISPLAY_ORDER = [
    'kospi', 'kosdaq', 'nasdaq', 'sp500', 'sox', 'usdkrw', 'vix', 'wti', 'copper',
]
_KIS_INDEX_ROWS_FIXED = [(row['name'], row['kis_code']) for row in _INDEX_ROWS]
_KIS_INDEX_TR = os.getenv('KIS_INDEX_TR_ID', 'FHPUP02100000')
_KIS_INDEX_TR_FB = os.getenv('KIS_INDEX_TR_ID_MOCK', 'VFPUP02100000')
_INDEX_CACHE = {'data': [], 'global': [], 'extras': [], 'ts': 0.0}
_INDEX_CACHE_TTL = int(os.getenv('MARKET_INDICES_CACHE_TTL_SEC', '15'))
_INDEX_HISTORY_CACHE = {}
_INDEX_HISTORY_TTL = float(os.getenv('MARKET_INDEX_HISTORY_CACHE_TTL_SEC', '60'))

_FX_USD_KRW_CACHE = {'payload': None, 'ts': 0.0}
_FX_USD_KRW_TTL = float(os.getenv('FX_USD_KRW_CACHE_TTL_SEC', '30'))
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
_WEB_PRICE_MAX_COUNT = int(os.getenv('LIVE_PRICE_MAX_COUNT', '100'))
_WEB_REQUEST_GAP_SEC = float(os.getenv('LIVE_PRICE_REQUEST_GAP_SEC', '0.35'))
_WEB_REFRESH_BATCH_SIZE = int(os.getenv('LIVE_PRICE_REFRESH_BATCH_SIZE', '10'))
_WEB_WARMUP_BATCH_SIZE = int(os.getenv('LIVE_PRICE_WARMUP_BATCH_SIZE', '20'))
_WEB_UPDATE_INTERVAL_SEC = float(os.getenv('LIVE_PRICE_UPDATE_INTERVAL_SEC', '0.9'))
_LIVE_PRICE_DB_SYNC_ENABLED = os.getenv('LIVE_PRICE_DB_SYNC_ENABLED', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_LIVE_BG_ENABLED = os.getenv('LIVE_PRICE_BG_ENABLED', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_LIVE_BG_INTERVAL_SEC = float(os.getenv('LIVE_PRICE_BG_INTERVAL_SEC', '2.0'))
_LIVE_BLOCK_OFFHOURS_FETCH = os.getenv('LIVE_PRICE_BLOCK_OFFHOURS_FETCH', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
# 장외·주말: DB에 없을 때 메모리 캐시·yfinance로 보강 (순수 DB만 쓰지 않음)
_LIVE_OFFHOURS_USE_CACHE = os.getenv('LIVE_PRICE_OFFHOURS_USE_CACHE', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_LIVE_OFFHOURS_YFINANCE = os.getenv('LIVE_PRICE_OFFHOURS_YFINANCE', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_LIVE_OFFHOURS_YF_BUDGET = max(0, int(os.getenv('LIVE_PRICE_OFFHOURS_YF_BUDGET', '12')))
# 장외: stock_price_daily 최신 일자가 오늘 기준 N일 이상 지났으면 yfinance 보강 대상 (0이면 비활성)
_LIVE_OFFHOURS_STALE_DAYS = max(0, int(os.getenv('LIVE_PRICE_OFFHOURS_STALE_DAYS', '2')))
# 차트: 토스 스타일 — range=1d/1w/1m/1y → 일/주/월/년봉. KIS 우선, 실패 시 yfinance. D 는 DB 캐시 우선.
_CHART_USE_KIS = os.getenv('CHART_USE_KIS', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_CHART_PERIOD_MAP = {'1d': 'D', '1w': 'W', '1m': 'M', '1y': 'Y'}
_CHART_TARGET_BARS = {'D': 500, 'W': 260, 'M': 120, 'Y': 30}
_CHART_MIN_BARS = {'D': 60, 'W': 30, 'M': 12, 'Y': 5}
_CHART_WINDOW_CAL_DAYS = {'D': 100, 'W': 700, 'M': 3000, 'Y': 36500}
_KIS_TOKEN_USE_DB = os.getenv('KIS_TOKEN_USE_DB', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_KR_MARKET_OPEN_HHMM = int(os.getenv('KR_MARKET_OPEN_HHMM', '900'))
_KR_MARKET_CLOSE_HHMM = int(os.getenv('KR_MARKET_CLOSE_HHMM', '1530'))
_MOCK_INITIAL_CASH = int(float(os.getenv('MOCK_INITIAL_CASH', '5000000')))

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
_KIS_TOKEN_DEADLINE = 0.0
_STOCK_DETAIL_CACHE = {}
_STOCK_DETAIL_CACHE_TTL = 60.0
# DB 스냅샷 TTL(초). 메모리 캐시보다 길게 두어 yfinance/KIS 호출 빈도를 줄임.
_STOCK_DETAIL_DB_TTL = 900.0
_BASIC_PEER_CACHE = {}
_BASIC_PEER_CACHE_TTL = 3600.0
_INVESTOR_FLOW_CACHE = {}
_INVESTOR_FLOW_CACHE_TTL = 120.0
