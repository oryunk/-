# 주린닷컴 - Python 백엔드 설정 가이드

## 1️⃣ 파이썬 환경 설정

### 가상환경 생성
```bash
# PowerShell에서 실행
python -m venv venv
```

### 가상환경 활성화
```bash
# Windows PowerShell
venv\Scripts\Activate.ps1

# 만약 권한 오류가 나면:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# 그 후 다시 위의 명령어 실행
```

### 라이브러리 설치
```bash
cd backend
pip install -r requirements.txt
```

### 환경변수 설정 (.env)
`backend/.env` 파일에 아래 값을 추가하세요.

```env
GEMINI_API_KEY=여기에_본인_제미나이_API_키
```

---

## 2️⃣ 서버 실행

```bash
# backend 디렉토리에서
python app.py
```

정상 실행 시 다음과 같은 메시지가 나타납니다:
```
 * Running on http://127.0.0.1:5000
```

---

## 3️⃣ AI 종목 분석 API 사용

### 요청
```javascript
const response = await fetch('http://localhost:5000/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stock_name: '삼성전자' })
});
```

### 응답 예시
```json
{
  "success": true,
  "stock_name": "삼성전자",
  "current_price": 75200,
  "change_rate": 1.24,
  "ma_20": 74500,
  "ma_60": 73800,
  "volatility": 2.35,
  "opinion": "강력매수",
  "target_price": 77000,
  "summary": "【종목: 삼성전자】\n현재가: 75,200원\n변동률: +1.24%\n\n【기술적 분석】\n...",
  "color": "green"
}
```

---

## 4️⃣ 지원 종목

현재 지원 종목:
- 삼성전자 (005930)
- SK하이닉스 (000660)
- NAVER (035420)
- 카카오 (035720)
- 현대차 (005380)
- LG전자 (066570)
- POSCO (005490)

다른 종목도 종목 코드로 직접 조회 가능합니다.

---

## 5️⃣ 전체 프로젝트 구조

```
캡스톤/
├── 주린닷컴홈피.html
├── analysis.html (API 연결됨)
├── ai-chart-prediction.html
├── glossary.html
├── simulation.html
├── market.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── ai.js
│   ├── slider.js
│   └── rss-loader.js
└── backend/
    ├── app.py (Flask 메인 앱)
    ├── requirements.txt
    └── .env
```

---

## 🐛 문제 해결

### 포트 5000이 이미 사용 중인 경우
```python
# app.py의 마지막 줄을 수정하세요
if __name__ == '__main__':
    app.run(debug=True, port=5001)  # 포트 변경
```

### CORS 오류가 나는 경우
Flask-CORS가 설치되어 있는지 확인하세요:
```bash
pip install Flask-CORS
```

### yfinance 데이터를 못 가져오는 경우
인터넷 연결을 확인하고, 다음 명령어로 업데이트하세요:
```bash
pip install --upgrade yfinance
```

---

## 📝 API 엔드포인트

### 1. `/api/analyze` (POST)
종목 AI 분석 요청

**요청 바디:**
```json
{
  "stock_name": "삼성전자"
}
```

**응답:** 상위 참고

### 2. `/api/health` (GET)
서버 상태 확인

**응답:**
```json
{
  "status": "ok",
  "message": "서버가 정상 작동 중입니다."
}
```

### 3. `/api/terms/explain` (POST)
금융/투자 용어 AI 설명 요청

**요청 바디:**
```json
{
  "term": "PER"
}
```

**응답 예시:**
```json
{
  "success": true,
  "term": "PER",
  "answer": "용어의 의미: ...\n특징: ...\n실제 투자 활용 예시: ..."
}
```
