# 파일명 예시: kis_realtime_chart.py

import json
import os
import threading
import time
from collections import deque
from datetime import datetime

import requests
import websocket

# ==============================
# 1) 본인 정보 입력
# ==============================
APP_KEY = ""
APP_SECRET = ""

# 실전: True / 모의: False
USE_PROD = True

# 실시간으로 볼 종목
WATCHLIST = {
    "005930": "삼성전자",
    "035720": "카카오",
    "000660": "SK하이닉스",
    "035420": "NAVER",
}

# 보관할 최근 체결 개수
MAX_POINTS = 120

# ==============================
# 2) 엔드포인트
# ==============================
REST_BASE = "https://openapi.koreainvestment.com:9443"
WS_URL_PROD = "ws://ops.koreainvestment.com:21000"
WS_URL = WS_URL_PROD if USE_PROD else "ws://ops.koreainvestment.com:31000"

# ==============================
# 3) 실시간 데이터 저장소
# ==============================
ws_connected = False
last_received_time = None

price_data = {
    code: {
        "name": name,
        "times": deque(maxlen=MAX_POINTS),
        "prices": deque(maxlen=MAX_POINTS),
        "last_price": None,
        "change_rate": None,
    }
    for code, name in WATCHLIST.items()
}

# WebSocket에서 오는 KRX 실시간체결가(H0STCNT0) 필드 순서
KRX_EXEC_FIELDS = [
    "MKSC_SHRN_ISCD",        # 종목코드
    "STCK_CNTG_HOUR",        # 체결시간
    "STCK_PRPR",             # 현재가
    "PRDY_VRSS_SIGN",        # 전일대비 부호
    "PRDY_VRSS",             # 전일대비
    "PRDY_CTRT",             # 전일대비율
    "WGHN_AVRG_STCK_PRC",    # 가중평균주가
    "STCK_OPRC",             # 시가
    "STCK_HGPR",             # 고가
    "STCK_LWPR",             # 저가
    "ASKP1",                 # 매도호가1
    "BIDP1",                 # 매수호가1
    "CNTG_VOL",              # 체결거래량
    "ACML_VOL",              # 누적거래량
]

# ==============================
# 4) 인증
# ==============================
def get_access_token(app_key: str, app_secret: str) -> str:
    url = f"{REST_BASE}/oauth2/tokenP"
    headers = {"content-type": "application/json; charset=utf-8"}
    body = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "appsecret": app_secret,   # tokenP 전용 필드명
        "secretkey": app_secret,   # 일부 환경에서 요구
    }
    res = requests.post(url, headers=headers, json=body, timeout=10)
    if not res.text.strip():
        raise RuntimeError(f"응답 body 없음 (HTTP {res.status_code})")
    try:
        data = res.json()
    except Exception:
        raise RuntimeError(f"JSON 파싱 실패 (HTTP {res.status_code}): {res.text[:200]}")
    res.raise_for_status()
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"access_token 없음 — 응답: {data}")
    return token


def fetch_last_price(access_token: str, code: str):
    """REST API로 종목의 현재가(장 마감 시 종가)를 조회한다."""
    url = f"{REST_BASE}/uapi/domestic-stock/v1/quotations/inquire-price"
    tr_id = "FHKST01010100" if USE_PROD else "VFHKST01010100"
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {access_token}",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
        "tr_id": tr_id,
    }
    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": code,
    }
    res = requests.get(url, headers=headers, params=params, timeout=10)
    res.raise_for_status()
    data = res.json()
    output = data.get("output", {})
    price_str = output.get("stck_prpr", "").replace(",", "").strip()
    rate_str = output.get("prdy_ctrt", "").replace(",", "").strip()
    try:
        price = int(price_str)
    except ValueError:
        return None, None
    try:
        rate = float(rate_str) if rate_str else None
    except ValueError:
        rate = None
    return price, rate


def prefetch_prices():
    """시작 시 REST API로 전 종목 가격을 미리 채운다."""
    try:
        token = get_access_token(APP_KEY, APP_SECRET)
    except Exception as e:
        print(f"access_token 발급 실패 (가격 미리 조회 생략): {e}")
        return

    for code in WATCHLIST:
        try:
            price, rate = fetch_last_price(token, code)
            if price is not None:
                price_data[code]["last_price"] = price
                price_data[code]["change_rate"] = rate
                now = datetime.now().strftime("%H:%M:%S")
                price_data[code]["times"].append(now)
                price_data[code]["prices"].append(price)
                print(f"[초기조회] {WATCHLIST[code]}({code}) {price:,}원")
        except Exception as e:
            print(f"[초기조회 실패] {code}: {e}")


def get_approval_key(app_key: str, app_secret: str) -> str:
    url = f"{REST_BASE}/oauth2/Approval"
    headers = {"content-type": "application/json; charset=utf-8"}
    body = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "secretkey": app_secret,
    }

    res = requests.post(url, headers=headers, json=body, timeout=10)
    res.raise_for_status()
    data = res.json()

    approval_key = data.get("approval_key")
    if not approval_key:
        raise RuntimeError(f"approval_key 발급 실패: {data}")
    return approval_key


# ==============================
# 5) 웹소켓 메시지 생성
# ==============================
def build_subscribe_message(approval_key: str, tr_id: str, tr_key: str) -> str:
    msg = {
        "header": {
            "approval_key": approval_key,
            "custtype": "P",
            "tr_type": "1",
            "content-type": "utf-8",
        },
        "body": {
            "input": {
                "tr_id": tr_id,
                "tr_key": tr_key,
            }
        },
    }
    return json.dumps(msg)


# ==============================
# 6) 실시간 체결가 파싱
# ==============================
def parse_execution_message(raw_text: str):
    if not raw_text or "|" not in raw_text:
        return None

    parts = raw_text.split("|")
    if len(parts) < 4:
        return None

    tr_id = parts[1].strip()
    if tr_id != "H0STCNT0":
        return None

    payload = parts[-1]
    values = payload.split("^")

    if len(values) < 6:
        return None

    mapped = {}
    for i, key in enumerate(KRX_EXEC_FIELDS):
        if i < len(values):
            mapped[key] = values[i]

    code = mapped.get("MKSC_SHRN_ISCD")
    if code not in WATCHLIST:
        return None

    price_str = mapped.get("STCK_PRPR", "").replace(",", "").strip()
    rate_str = mapped.get("PRDY_CTRT", "").replace(",", "").strip()
    time_str = mapped.get("STCK_CNTG_HOUR", "").strip()

    try:
        price = int(price_str)
    except ValueError:
        return None

    try:
        rate = float(rate_str) if rate_str else None
    except ValueError:
        rate = None

    if len(time_str) == 6:
        display_time = f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:]}"
    else:
        display_time = datetime.now().strftime("%H:%M:%S")

    return {
        "code": code,
        "name": WATCHLIST[code],
        "time": display_time,
        "price": price,
        "change_rate": rate,
    }


# ==============================
# 7) WebSocket 콜백
# ==============================
def on_open(ws):
    global ws_connected
    ws_connected = True
    print("WebSocket 연결 성공")
    approval_key = ws.approval_key

    for code in WATCHLIST.keys():
        sub_msg = build_subscribe_message(
            approval_key=approval_key,
            tr_id="H0STCNT0",
            tr_key=code,
        )
        ws.send(sub_msg)
        print(f"구독 등록: {code}")


def on_message(ws, message):
    global last_received_time
    if not isinstance(message, str):
        return

    if message.startswith("{"):
        return

    parsed = parse_execution_message(message)
    if not parsed:
        return

    last_received_time = datetime.now().strftime("%H:%M:%S")
    code = parsed["code"]
    price_data[code]["times"].append(parsed["time"])
    price_data[code]["prices"].append(parsed["price"])
    price_data[code]["last_price"] = parsed["price"]
    price_data[code]["change_rate"] = parsed["change_rate"]

    change_str = ""
    if parsed["change_rate"] is not None:
        sign = "+" if parsed["change_rate"] >= 0 else ""
        change_str = f"({sign}{parsed['change_rate']}%)"

    print(f"[{parsed['time']}] {parsed['name']}({code})  {parsed['price']:,}원  {change_str}")


def on_error(ws, error):
    print("WebSocket 오류:", error)


def on_close(ws, close_status_code, close_msg):
    global ws_connected
    ws_connected = False
    print("WebSocket 종료:", close_status_code, close_msg)


# ==============================
# 8) 터미널 요약 출력
# ==============================
def print_summary():
    """현재 종목별 최신 가격을 터미널에 주기적으로 출력한다."""
    while True:
        time.sleep(5)
        now = datetime.now().strftime("%H:%M:%S")
        os.system("cls" if os.name == "nt" else "clear")
        conn_status = "연결됨" if ws_connected else "연결 안됨"
        data_status = f"마지막 수신: {last_received_time}" if last_received_time else "수신 데이터 없음"
        print(f"=== 한국투자증권 실시간 체결가  [{now}] ===")
        print(f"WebSocket: {conn_status}  |  {data_status}")
        print(f"{'종목명':<12} {'코드':<8} {'현재가':>10} {'등락률':>8} {'체결시간':>10}")
        print("-" * 55)
        for code, data in price_data.items():
            name = data["name"]
            price = data["last_price"]
            rate = data["change_rate"]
            last_time = data["times"][-1] if data["times"] else "-"

            if price is None:
                print(f"{name:<12} {code:<8} {'조회중':>10} {'-':>8} {'-':>10}")
                continue

            sign = "+" if rate is not None and rate >= 0 else ""
            rate_str = f"{sign}{rate}%" if rate is not None else "-"
            print(f"{name:<12} {code:<8} {price:>10,}원 {rate_str:>8} {last_time:>10}")
        print("-" * 55)
        print("(Ctrl+C 로 종료)")


# ==============================
# 9) 실행
# ==============================
def run_websocket():
    approval_key = get_approval_key(APP_KEY, APP_SECRET)
    print("approval_key 발급 완료")

    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )
    ws.approval_key = approval_key
    ws.run_forever()


def main():
    if not APP_KEY or not APP_SECRET:
        print("APP_KEY 또는 APP_SECRET이 설정되지 않았습니다. 키를 입력 후 다시 실행해주세요.")
        return

    prefetch_prices()

    ws_thread = threading.Thread(target=run_websocket, daemon=True)
    ws_thread.start()

    summary_thread = threading.Thread(target=print_summary, daemon=True)
    summary_thread.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n종료합니다.")


if __name__ == "__main__":
    main()
