# # 파일명 예시: kis_realtime_chart.py

# import json
# import threading
# import time
# from collections import defaultdict, deque
# from datetime import datetime

# import requests
# import websocket
# import matplotlib.pyplot as plt
# from matplotlib.animation import FuncAnimation

# import matplotlib.pyplot as plt
# import matplotlib.font_manager as fm
# import matplotlib as mpl

# mpl.rcParams["font.family"] = "Malgun Gothic"   # 윈도우 기본 한글 폰트
# mpl.rcParams["axes.unicode_minus"] = False

# # ==============================
# # 1) 본인 정보 입력
# # ==============================
# APP_KEY = "PS0GIKTSuRv6sBK4pnu67BqiTsqZti04AXSF"
# APP_SECRET = "qqumgcJi/UwehOHzcCGU23QJDoVbNn21vmKXTwiqYhtXDY1VXWbyI39ZdyaB/5kSyA9i7xsroqc34LFhz6+Akw0c7BFcRxiqRNQexIj2pvobYtvxSZMpRzC2xhOrPzI0rCYedBwS0vtNj0fKT7+AQsSi6zUqcujS8eiTqDYwytoT2/nNxFU="

# # 실전: True / 모의: False
# # 기본은 실전 기준으로 작성
# USE_PROD = True

# # 실시간으로 볼 종목
# WATCHLIST = {
#     "005930": "삼성전자",
#     "035720": "카카오",
#     "000660": "SK하이닉스",
#     "035420": "NAVER",
# }

# # 차트에 유지할 최근 체결 개수
# MAX_POINTS = 120

# # ==============================
# # 2) 엔드포인트
# # ==============================
# REST_BASE = "https://openapi.koreainvestment.com:9443"
# WS_URL_PROD = "ws://ops.koreainvestment.com:21000"
# # 모의투자 웹소켓 주소는 계정 환경에 따라 별도 확인 필요
# # 실전 기준으로 먼저 구현
# WS_URL = WS_URL_PROD if USE_PROD else "ws://ops.koreainvestment.com:31000"

# # ==============================
# # 3) 실시간 데이터 저장소
# # ==============================
# price_data = {
#     code: {
#         "name": name,
#         "times": deque(maxlen=MAX_POINTS),
#         "prices": deque(maxlen=MAX_POINTS),
#         "last_price": None,
#         "change_rate": None,
#     }
#     for code, name in WATCHLIST.items()
# }

# # WebSocket에서 오는 KRX 실시간체결가(H0STCNT0) 필드 순서 일부
# # 공식 샘플의 컬럼 정의를 기준으로 앞부분을 매핑
# KRX_EXEC_FIELDS = [
#     "MKSC_SHRN_ISCD",        # 종목코드
#     "STCK_CNTG_HOUR",        # 체결시간
#     "STCK_PRPR",             # 현재가
#     "PRDY_VRSS_SIGN",        # 전일대비 부호
#     "PRDY_VRSS",             # 전일대비
#     "PRDY_CTRT",             # 전일대비율
#     "WGHN_AVRG_STCK_PRC",    # 가중평균주가
#     "STCK_OPRC",             # 시가
#     "STCK_HGPR",             # 고가
#     "STCK_LWPR",             # 저가
#     "ASKP1",                 # 매도호가1
#     "BIDP1",                 # 매수호가1
#     "CNTG_VOL",              # 체결거래량
#     "ACML_VOL",              # 누적거래량
# ]

# # ==============================
# # 4) approval_key 발급
# # ==============================
# def get_approval_key(app_key: str, app_secret: str) -> str:
#     url = f"{REST_BASE}/oauth2/Approval"
#     headers = {"content-type": "application/json; charset=utf-8"}
#     body = {
#         "grant_type": "client_credentials",
#         "appkey": app_key,
#         "secretkey": app_secret,
#     }

#     res = requests.post(url, headers=headers, json=body, timeout=10)
#     res.raise_for_status()
#     data = res.json()

#     approval_key = data.get("approval_key")
#     if not approval_key:
#         raise RuntimeError(f"approval_key 발급 실패: {data}")
#     return approval_key


# # ==============================
# # 5) 웹소켓 메시지 생성
# # ==============================
# def build_subscribe_message(approval_key: str, tr_id: str, tr_key: str) -> str:
#     msg = {
#         "header": {
#             "approval_key": approval_key,
#             "custtype": "P",
#             "tr_type": "1",              # 1: 구독 등록
#             "content-type": "utf-8",
#         },
#         "body": {
#             "input": {
#                 "tr_id": tr_id,
#                 "tr_key": tr_key,
#             }
#         },
#     }
#     return json.dumps(msg)


# # ==============================
# # 6) 실시간 체결가 파싱
# # ==============================
# # def parse_execution_message(raw_text: str):
# #     """
# #     KIS 실시간 체결가 메시지는 보통 '|' 구분 헤더 + '^' 구분 데이터 형태로 옴.
# #     예: 0|H0STCNT0|...|필드1^필드2^필드3...
# #     """
# #     if not raw_text or "|" not in raw_text:
# #         return None

# #     parts = raw_text.split("|")
# #     if len(parts) < 4:
# #         return None

# #     # 실시간 데이터 프레임만 처리
# #     tr_id = parts[1].strip()

# #     # 국내주식 실시간체결가(KRX)
# #     if tr_id != "H0STCNT0":
# #         return None

# #     payload = parts[-1]
# #     values = payload.split("^")

# #     if len(values) < 6:
# #         return None

# #     mapped = {}
# #     for i, key in enumerate(KRX_EXEC_FIELDS):
# #         if i < len(values):
# #             mapped[key] = values[i]

# #     code = mapped.get("MKSC_SHRN_ISCD")
# #     if code not in WATCHLIST:
# #         return None

# #     price_str = mapped.get("STCK_PRPR", "").replace(",", "").strip()
# #     rate_str = mapped.get("PRDY_CTRT", "").replace(",", "").strip()
# #     time_str = mapped.get("STCK_CNTG_HOUR", "").strip()

# #     try:
# #         price = int(price_str)
# #     except ValueError:
# #         return None

# #     try:
# #         rate = float(rate_str) if rate_str else None
# #     except ValueError:
# #         rate = None

# #     if len(time_str) == 6:
# #         display_time = f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:]}"
# #     else:
# #         display_time = datetime.now().strftime("%H:%M:%S")

# #     return {
# #         "code": code,
# #         "name": WATCHLIST[code],
# #         "time": display_time,
# #         "price": price,
# #         "change_rate": rate,
# #     }
# def parse_execution_message(raw_text: str):
#     if not raw_text or "|" not in raw_text:
#         return None

#     parts = raw_text.split("|")
#     print("parts:", parts)

#     if len(parts) < 4:
#         return None

#     tr_id = parts[1].strip()
#     print("tr_id:", tr_id)

#     if tr_id != "H0STCNT0":
#         return None

#     payload = parts[-1]
#     values = payload.split("^")
#     print("values 앞 10개:", values[:10])

#     if len(values) < 6:
#         return None

#     mapped = {}
#     for i, key in enumerate(KRX_EXEC_FIELDS):
#         if i < len(values):
#             mapped[key] = values[i]

#     code = mapped.get("MKSC_SHRN_ISCD")
#     if code not in WATCHLIST:
#         print("watchlist에 없는 코드:", code)
#         return None

#     price_str = mapped.get("STCK_PRPR", "").replace(",", "").strip()
#     rate_str = mapped.get("PRDY_CTRT", "").replace(",", "").strip()
#     time_str = mapped.get("STCK_CNTG_HOUR", "").strip()

#     try:
#         price = int(price_str)
#     except ValueError:
#         print("가격 변환 실패:", price_str)
#         return None

#     try:
#         rate = float(rate_str) if rate_str else None
#     except ValueError:
#         rate = None

#     if len(time_str) == 6:
#         display_time = f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:]}"
#     else:
#         display_time = datetime.now().strftime("%H:%M:%S")

#     return {
#         "code": code,
#         "name": WATCHLIST[code],
#         "time": display_time,
#         "price": price,
#         "change_rate": rate,
#     }


# # ==============================
# # 7) WebSocket 콜백
# # ==============================
# def on_open(ws):
#     print("WebSocket 연결 성공")
#     approval_key = ws.approval_key

#     # H0STCNT0 = 국내주식 실시간체결가(KRX)
#     for code in WATCHLIST.keys():
#         sub_msg = build_subscribe_message(
#             approval_key=approval_key,
#             tr_id="H0STCNT0",
#             tr_key=code,
#         )
#         ws.send(sub_msg)
#         print(f"구독 등록: {code}")

# # def on_message(ws, message):
# #     # 문자열 메시지만 처리
# #     if not isinstance(message, str):
# #         return

# #     parsed = parse_execution_message(message)
# #     if not parsed:
# #         return

# #     code = parsed["code"]
# #     price_data[code]["times"].append(parsed["time"])
# #     price_data[code]["prices"].append(parsed["price"])
# #     price_data[code]["last_price"] = parsed["price"]
# #     price_data[code]["change_rate"] = parsed["change_rate"]

# #     change_str = ""
# #     if parsed["change_rate"] is not None:
# #         change_str = f"({parsed['change_rate']}%)"

# #     print(
# #         f"[{parsed['time']}] {parsed['name']}({code}) "
# #         f"{parsed['price']:,}원 {change_str}"
# #     )

# # def on_error(ws, error):
# #     print("WebSocket 오류:", error)

# # def on_close(ws, close_status_code, close_msg):
# #     print("WebSocket 종료:", close_status_code, close_msg)

# def on_message(ws, message):
#     print("수신 원문:", message)

#     if not isinstance(message, str):
#         return

#     if message.startswith("{"):
#         print("JSON 메시지 수신")
#         return

#     parsed = parse_execution_message(message)
#     if not parsed:
#         print("파싱 실패")
#         return

#     code = parsed["code"]
#     price_data[code]["times"].append(parsed["time"])
#     price_data[code]["prices"].append(parsed["price"])
#     price_data[code]["last_price"] = parsed["price"]
#     price_data[code]["change_rate"] = parsed["change_rate"]

#     change_str = ""
#     if parsed["change_rate"] is not None:
#         change_str = f"({parsed['change_rate']}%)"

#     print(f"[{parsed['time']}] {parsed['name']}({code}) {parsed['price']:,}원 {change_str}")


# # ==============================
# # 8) 차트 그리기
# # ==============================
# # def animate(_):
# #     plt.clf()

# #     active_codes = [c for c in WATCHLIST if len(price_data[c]["prices"]) > 0]
# #     if not active_codes:
# #         plt.title("실시간 체결가 수신 대기 중...")
# #         plt.xlabel("시간")
# #         plt.ylabel("가격")
# #         return

# #     for code in active_codes:
# #         name = price_data[code]["name"]
# #         times = list(price_data[code]["times"])
# #         prices = list(price_data[code]["prices"])
# #         plt.plot(times, prices, label=f"{name}({code})")

# #     plt.title("한국투자증권 실시간 체결가")
# #     plt.xlabel("체결시간")
# #     plt.ylabel("가격")
# #     plt.xticks(rotation=45)
# #     plt.legend()
# #     plt.tight_layout()
# def animate(_):
#     plt.clf()

#     active_codes = [c for c in WATCHLIST if len(price_data[c]["prices"]) > 0]

#     if not active_codes:
#         plt.title("실시간 체결가 수신 대기 중...")
#         plt.xlabel("시간")
#         plt.ylabel("가격")
#         plt.grid(True)
#         return

#     for code in active_codes:
#         name = price_data[code]["name"]
#         times = list(price_data[code]["times"])
#         prices = list(price_data[code]["prices"])
#         plt.plot(times, prices, marker="o", label=f"{name}({code})")

#     plt.title("한국투자증권 실시간 체결가")
#     plt.xlabel("시간")
#     plt.ylabel("가격")
#     plt.xticks(rotation=45)
#     plt.legend()
#     plt.grid(True)
#     plt.tight_layout()


# # ==============================
# # 9) 실행
# # ==============================
# def run_websocket():
#     approval_key = get_approval_key(APP_KEY, APP_SECRET)
#     print("approval_key 발급 완료")

#     ws = websocket.WebSocketApp(
#         WS_URL,
#         on_open=on_open,
#         on_message=on_message,
#         on_error=on_error,
#         on_close=on_close,
#     )
#     ws.approval_key = approval_key
#     ws.run_forever()


# def main():
#     t = threading.Thread(target=run_websocket, daemon=True)
#     t.start()

#     fig = plt.figure(figsize=(12, 7))
#     ani = FuncAnimation(fig, animate, interval=1000, cache_frame_data=False)
#     plt.show()


# if __name__ == "__main__":
#     main()