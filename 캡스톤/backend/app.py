from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = Flask(__name__)
CORS(app)

# Gemini API 설정
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyDvabBrAzgjB20EO9VpHCPzAOaO2yZi-dY')
try:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    GEMINI_AVAILABLE = True
except Exception as e:
    print(f'[WARN] Gemini API 초기화 실패: {e}')
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

def call_gemini(prompt_text):
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt_text
        )
        return {'success': True, 'text': response.text}
    except Exception as err:
        print(f'[Gemini] 호출 실패: {err}')
        return {'success': False, 'message': str(err)}

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

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """종목 분석 API 엔드포인트"""
    data = request.json
    stock_name = data.get('stock_name', '').strip()
    
    if not stock_name:
        return jsonify({'success': False, 'message': '종목명을 입력해주세요.'}), 400
    
    result = analyze_stock(stock_name)
    return jsonify(result)

@app.route('/api/health', methods=['GET'])
def health():
    """헬스 체크"""
    return jsonify({'status': 'ok', 'message': '서버가 정상 작동 중입니다.'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
