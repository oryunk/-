import os
import time
import json
import requests
from dotenv import load_dotenv

# 환경 변수 로드 
load_dotenv()

APP_KEY = os.getenv("KIS_APP_KEY")
APP_SECRET = os.getenv("KIS_APP_SECRET")
BASE_URL = "https://openapivts.koreainvestment.com:29443" # 서버
TOKEN_FILE = "token_vts.json"
LAST_PRICES = {}

RED = "\033[31m"    # 상승 (빨강)
BLUE = "\033[34m"   # 하락 (파랑)
RESET = "\033[0m"   # 색상 초기화 

STOCKS = {
    "005930": "삼성전자",
    "000660": "SK하이닉스",
    "035420": "NAVER",
}

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
    res = requests.post(url, json=payload)
    
    if res.status_code == 200:
        new_token = res.json().get('access_token')
        
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
    """시세 조회 함수 (이전과 동일)"""
    url = f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = {
        "Content-Type": "application/json",
        "authorization": f"Bearer {token}",
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
        "tr_id": "FHKST01010100"
    }
    params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": stock_code}
    
    res = requests.get(url, headers=headers, params=params)
    if res.status_code == 200:
        # 1. 현재가 숫자로 변환
        price_str = res.json()['output']['stck_prpr']
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
        
        # 4. 한 눈에 들어오게 출력 (가격 + 변동폭)
        print(f"[{stock_name:10}] 현재가: {price_str:>8}원 | 변동: {color}{diff_str:>8}{RESET}")
    else:
        print(f"[{stock_name}] 시세 조회 실패")

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

# --- 메인 실행부 ---
if __name__ == "__main__":
    try:
       # 1. 토큰 가져오기 
        auth_token = get_access_token()
        if auth_token:
            while True:
                for code, name in STOCKS.items():
                    get_current_price(auth_token, code, name) # 주식 종목 불러옴
                
                    
                    print("-" * 50) # 구분선
                    time.sleep(5)   # 5초 대기
    except KeyboardInterrupt:
        print("\n 사용자에 의해 실시간 조회를 종료합니다.")