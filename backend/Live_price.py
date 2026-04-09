import os
import time
import json
import requests
from auth_api import get_connection
from dotenv import load_dotenv

# 환경 변수 로드 
load_dotenv()

APP_KEY = os.getenv("KIS_APP_KEY")
APP_SECRET = os.getenv("KIS_APP_SECRET")
USE_PROD = os.getenv("KIS_USE_PROD", "false").strip().lower() in {"1", "true", "y", "yes", "on"}
BASE_URL = "https://openapi.koreainvestment.com:9443" if USE_PROD else "https://openapivts.koreainvestment.com:29443"
PRICE_TR_ID = "FHKST01010100" if USE_PROD else "VFHKST01010100"
FALLBACK_TR_ID = "VFHKST01010100" if USE_PROD else "FHKST01010100"
TOKEN_FILE = "token_vts.json"
LAST_PRICES = {}
ACTIVE_TR_ID = None
LAST_REQUEST_TS = 0.0

# 호출 제한 대응 설정
MIN_REQUEST_INTERVAL = float(os.getenv("KIS_MIN_REQUEST_INTERVAL", "0.35"))
MAX_REQUEST_INTERVAL = float(os.getenv("KIS_MAX_REQUEST_INTERVAL", "1.20"))
RATE_LIMIT_RETRIES = int(os.getenv("KIS_RATE_LIMIT_RETRIES", "2"))
RATE_LIMIT_BACKOFF = float(os.getenv("KIS_RATE_LIMIT_BACKOFF", "0.5"))
RATE_LIMIT_PENALTY = float(os.getenv("KIS_RATE_LIMIT_PENALTY", "0.10"))
SUCCESS_RELAX_STEP = float(os.getenv("KIS_SUCCESS_RELAX_STEP", "0.01"))
POLL_LOOP_SLEEP = float(os.getenv("KIS_POLL_LOOP_SLEEP", "0.0"))
CURRENT_REQUEST_INTERVAL = MIN_REQUEST_INTERVAL

RED = "\033[31m"    # 상승 (빨강)
BLUE = "\033[34m"   # 하락 (파랑)
RESET = "\033[0m"   # 색상 초기화 

STOCKS = {
    "005930": "삼성전자",
    "000660": "SK하이닉스",
    "035420": "NAVER",
    "005380": "현대차",
    "000270": "기아",
    "035720": "카카오",
    "373220": "LG에너지솔루션",
    "207940": "삼성바이오로직스",
    "068270": "셀트리온",
    "005490": "POSCO홀딩스",
    "003670": "포스코퓨처엠",
    "006400": "삼성SDI",
    "051910": "LG화학",
    "012330": "현대모비스",
    "028260": "삼성물산",
    "066570": "LG전자",
    "096770": "SK이노베이션",
    "017670": "SK텔레콤",
    "015760": "한국전력",
    "105560": "KB금융",
    "055550": "신한지주",
    "086790": "하나금융지주",
    "316140": "우리금융지주",
    "032830": "삼성생명",
    "000810": "삼성화재",
    "009150": "삼성전기",
    "018260": "삼성에스디에스",
    "267250": "HD현대",
    "329180": "HD현대중공업",
    "010130": "고려아연",
    "011200": "HMM",
    "047050": "포스코인터내셔널",
    "033780": "KT&G",
    "030200": "KT",
    "259960": "크래프톤",
    "352820": "하이브",
    "302440": "SK바이오사이언스",
    "251270": "넷마블",
    "161390": "한국타이어앤테크놀로지",
    "034020": "두산에너빌리티",
    "004020": "현대제철",
    "003550": "LG",
    "010950": "S-Oil",
    "090430": "아모레퍼시픽",
    "011170": "롯데케미칼",
    "000100": "유한양행",
    "078930": "GS",
    "271560": "오리온",
    "005935": "삼성전자우",
    "036570": "엔씨소프트",
    "001040": "CJ",
    "071050": "한국금융지주",
    "097950": "CJ제일제당",
}

_DASHBOARD_LINES = len(STOCKS) + 1  # 종목 수 + 상태 줄
_dashboard_initialized = False

# Windows 터미널에서 ANSI 이스케이프 코드 활성화
if os.name == "nt":
    os.system("")


def wait_request_slot():
    """KIS 초당 호출 제한을 피하기 위해 요청 간 최소 간격을 보장한다."""
    global LAST_REQUEST_TS
    now = time.monotonic()
    remaining = CURRENT_REQUEST_INTERVAL - (now - LAST_REQUEST_TS)
    if remaining > 0:
        time.sleep(remaining)
    LAST_REQUEST_TS = time.monotonic()


def on_rate_limited():
    """호출 제한 발생 시 다음 요청 간격을 보수적으로 늘린다."""
    global CURRENT_REQUEST_INTERVAL
    CURRENT_REQUEST_INTERVAL = min(MAX_REQUEST_INTERVAL, CURRENT_REQUEST_INTERVAL + RATE_LIMIT_PENALTY)


def on_request_success():
    """안정 구간에서는 요청 간격을 천천히 원래 값으로 되돌린다."""
    global CURRENT_REQUEST_INTERVAL
    CURRENT_REQUEST_INTERVAL = max(MIN_REQUEST_INTERVAL, CURRENT_REQUEST_INTERVAL - SUCCESS_RELAX_STEP)


def parse_error_payload(res):
    """응답 본문(JSON 가능 시)을 파싱해 주요 오류 코드를 뽑는다."""
    try:
        body = res.json()
    except ValueError:
        return None, None, None

    # KIS 응답에서 제한 오류는 message=EGW00201 형태로 내려오는 경우가 있다.
    err_code = body.get("message") or body.get("msg_cd")
    err_msg = body.get("msg1")
    return body, err_code, err_msg

def get_access_token():
    """파일을 확인해서 토큰이 있으면 쓰고, 없거나 만료됐으면 새로 받는 함수"""
    
    # 1. 파일이 있는지 확인하고, 있다면 읽어옴
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            token_data = json.load(f)
            
            # time.time()은 현재 시간, saved_at은 저장된 시간
            if time.time() - token_data["saved_at"] < 18000: 
                return token_data["access_token"]

    # 2. 파일이 없거나 시간이 너무 지났다면 새로 발급
    print(" 토큰이 없거나 만료되어 새로 발급받습니다...")
    url = f"{BASE_URL}/oauth2/tokenP"
    payload = {
        "grant_type": "client_credentials",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET
    }
    if not APP_KEY or not APP_SECRET:
        print(" KIS_APP_KEY/KIS_APP_SECRET 환경변수가 비어 있습니다. .env 설정을 확인하세요.")
        return None

    try:
        res = requests.post(url, json=payload, timeout=10)
    except requests.RequestException as e:
        print(f" 토큰 발급 요청 실패: {e}")
        return None
    
    if res.status_code == 200:
        try:
            token_json = res.json()
        except ValueError:
            print(f" 토큰 응답 JSON 파싱 실패: {res.text[:200]}")
            return None

        new_token = token_json.get('access_token')
        if not new_token:
            print(f" 토큰 발급 실패(응답 형식): {token_json}")
            return None
        
        # 새로 받은 토큰을 파일에 저장
        with open(TOKEN_FILE, "w") as f:
            json.dump({
                "access_token": new_token,
                "saved_at": time.time()
            }, f)
            
        print("새 토큰 발급 및 파일 저장 완료!")
        return new_token
    else:
        print(f" 토큰 발급 실패: {res.text}")
        return None

def get_current_price(token, stock_code, stock_name):
    """시세 조회 후 결과 dict 반환. 성공: price_str/diff_str/color 포함, 실패: error 포함."""
    global ACTIVE_TR_ID
    url = f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = {
        "Content-Type": "application/json",
        "authorization": f"Bearer {token}",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
    }
    params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": stock_code}

    tr_id_candidates = [ACTIVE_TR_ID] if ACTIVE_TR_ID else [PRICE_TR_ID, FALLBACK_TR_ID]
    last_failure = None
    for tr_id in tr_id_candidates:
        trial_headers = dict(headers)
        trial_headers["tr_id"] = tr_id

        for attempt in range(RATE_LIMIT_RETRIES + 1):
            wait_request_slot()

            try:
                res = requests.get(url, headers=trial_headers, params=params, timeout=10)
            except requests.RequestException as e:
                last_failure = f"요청 실패: {e}"
                break

            body, err_code, err_msg = parse_error_payload(res)

            if res.status_code != 200:
                if err_code == "EGW00201" and attempt < RATE_LIMIT_RETRIES:
                    on_rate_limited()
                    backoff = RATE_LIMIT_BACKOFF * (2 ** attempt)
                    time.sleep(backoff)
                    continue
                if err_code == "EGW00201":
                    on_rate_limited()
                if err_code:
                    last_failure = f"HTTP {res.status_code}, msg_cd={err_code} msg1={err_msg}"
                else:
                    last_failure = f"HTTP {res.status_code}, body={res.text[:200]}"
                break

            if body is None:
                last_failure = f"JSON 파싱 실패: {res.text[:200]}"
                break

            if body.get("rt_cd") not in ("0", 0, None):
                msg_cd = body.get("msg_cd")
                msg1 = body.get("msg1")
                rate_code = body.get("message")

                # 호출 제한 오류는 짧게 백오프 후 동일 TR_ID 재시도
                if rate_code == "EGW00201" and attempt < RATE_LIMIT_RETRIES:
                    on_rate_limited()
                    backoff = RATE_LIMIT_BACKOFF * (2 ** attempt)
                    time.sleep(backoff)
                    continue
                if rate_code == "EGW00201":
                    on_rate_limited()

                last_failure = f"msg_cd={msg_cd or rate_code} msg1={msg1}"
                # 계정/환경에 따라 TR_ID 차이가 있으므로 서비스 코드 오류는 대체 TR_ID 재시도
                if msg_cd == "OPSQ0002" and tr_id != tr_id_candidates[-1]:
                    break
                if msg_cd == "OPSQ0002" and ACTIVE_TR_ID and tr_id == ACTIVE_TR_ID:
                    ACTIVE_TR_ID = None
                break

            output = body.get("output") or {}
            price_str = (output.get("stck_prpr") or "").replace(",", "").strip()
            if not price_str.isdigit():
                last_failure = f"현재가 필드 이상: {output}"
                break

            ACTIVE_TR_ID = tr_id
            on_request_success()

            # 1. 현재가 숫자로 변환
            curr_price = int(price_str)

            # 2. 이전 가격 불러오기 및 비교
            last_price = LAST_PRICES.get(stock_code)

            color = ""

            if last_price is None:
                diff_str = "첫 조회"
            else:
                diff = curr_price - last_price
                if diff > 0:
                    diff_str = f"▲{diff}"
                    color = RED
                elif diff < 0:
                    diff_str = f"▼{abs(diff)}"
                    color = BLUE
                else:
                    diff_str = "-"
                    color = RESET

            # 3. 현재가를 다음 비교를 위해 저장
            LAST_PRICES[stock_code] = curr_price

            # 4. 결과 반환 (화면 출력은 render_dashboard가 담당)
            return {"name": stock_name, "price_str": price_str, "diff_str": diff_str, "color": color}

    return {"name": stock_name, "error": last_failure or "알 수 없는 오류"}

def render_dashboard(results):
    """모든 종목 결과를 한 번에 터미널에 출력하고, 이후 호출에서는 같은 자리를 덮어쓴다."""
    global _dashboard_initialized

    CURSOR_UP = f"\033[{_DASHBOARD_LINES}A"
    CLEAR_LINE = "\033[2K\r"

    if _dashboard_initialized:
        print(CURSOR_UP, end="", flush=True)

    for r in results:
        name = r["name"]
        if "error" in r:
            line = f"[{name:10}] 시세 조회 실패: {r['error']}"
        else:
            line = (
                f"[{name:10}] 현재가: {r['price_str']:>8}원"
                f" | 변동: {r['color']}{r['diff_str']:>8}{RESET}"
            )
        print(f"{CLEAR_LINE}{line}")

    ts = time.strftime("%H:%M:%S")
    print(
        f"{CLEAR_LINE}{'─' * 44} {ts}  간격: {CURRENT_REQUEST_INTERVAL:.2f}s",
        flush=True,
    )

    _dashboard_initialized = True


def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def update_db_stock_price(symbol, price):
    """실제로 DB에 값을 대입하는 함수"""
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            # 콤마 제거 및 숫자 변환
            clean_price = int(str(price).replace(',', ''))
            
            # stocks 테이블의 current_price 업데이트
            sql = "UPDATE stocks SET current_price = %s, updated_at = NOW() WHERE symbol = %s"
            cursor.execute(sql, (clean_price, symbol))
            conn.commit()
    except Exception as e:
        print(f"[DB 업데이트 오류] {symbol}: {e}")
    finally:
        if conn:
            conn.close()

# 기존 start_async_collector 함수 내부 수정
def start_async_collector():
    print("[엔진] DB 연동 수집 모드 가동...")
    while True:
        token = get_access_token()
        if not token:
            time.sleep(10)
            continue

        for code, name in STOCKS.items():
            # 1. 시세 가져오기
            res = get_current_price(token, code, name)
            
            if "price_str" in res:
                # 2. [핵심] 여기서 DB에 값을 대입해야 함!
                update_db_stock_price(code, res["price_str"])
                print(f"[{name}] DB 업데이트 성공: {res['price_str']}원")
        
        time.sleep(10)
        


