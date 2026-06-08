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

프론트는 보통 `frontend/` 아래 HTML·JS·CSS가 있고, 백엔드는 이 디렉터리(`backend/`)입니다.

```
backend/
├── app.py              # Flask 앱 진입점, 일부 라우트·로직(점진적으로 분리 중)
├── app_state.py        # 공유 상태·상수
├── auth_api.py         # 인증 Blueprint 등
├── api/                # 도메인별 HTTP API (URL·라우트)
├── services/           # 라우트 없는 공용 로직 (GPT, RSS 등)
├── news_service.py     # 뉴스 DB 접근 등 (레거시·도메인 모듈과 공존)
├── requirements.txt
└── .env
```

---

## 6️⃣ `api/` vs `services/` 구분 기준

| 위치 | 역할 | 나누는 기준 |
|------|------|-------------|
| `api/` | URL·HTTP 레이어 (라우트, `jsonify`, `request`) | 기능·도메인별 API 묶음 |
| `services/` | Flask에 묶이지 않는 실행 로직 | 여러 라우트·`app.py`에서 재사용하는 구현 (예: GPT 호출, RSS 수집) |
| `app.py` | 메인 앱 + 아직 여기 남은 라우트·무거운 로직 | 라우트는 `api/`로, 복잡한 본문은 `services/`로 **점진 이전** 중 |

- **api**: `app.register_blueprint(...)` 로 등록된 것만큼 해당 URL이 살아 있습니다. 제거하면 그 API는 동작하지 않습니다.
- **services**: `app.py`나 `api/`에서 `from services.... import` 로 쓰는 모듈입니다. 그 기능을 유지하려면 폴더·파일이 필요합니다.

예: `api/news.py`는 엔드포인트만 두고, RSS는 `services/rss_feed.py`, 독자용 요약은 `services/news_reader.py`, 문장 정리는 `services/gpt_client.py` 등에 둡니다.

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
