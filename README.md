# 주린닷컴 (캡스톤)

주린이를 위한 주식 AI·시세·모의투자 웹 프로젝트입니다. **Flask 백엔드**와 정적 **frontend**(HTML/CSS/JS)로 구성됩니다.

---

## 프로젝트 구조

```
프로젝트 루트/          ← Cursor/VS Code에서 여는 폴더 (backend와 frontend가 보이는 층)
├── backend/
│   ├── app.py              Flask 메인 앱, REST API, 정적 파일 서빙
│   ├── requirements.txt
│   ├── auth_api.py         로그인·회원 API
│   ├── cors_helpers.py     CORS 헤더 (app / signup 공용)
│   ├── Live_price.py       시세 DB 동기화
│   ├── price.py            종목 코드표
│   └── .env.example        환경 변수 템플릿 → 복사 후 `.env` 로 사용
├── frontend/
│   ├── 주린닷컴홈피.html   메인
│   ├── market.html         시장·종목·차트
│   ├── sector.html         섹터
│   ├── simulation.html     모의투자
│   ├── analysis.html       AI 종목 분석
│   ├── glossary.html       용어
│   ├── news.html
│   ├── ai-chart-prediction.html
│   ├── signup.html 등
│   ├── css/style.css
│   └── js/                 api-base.js, app.js, rss-loader.js 등
├── .vscode/                tasks.json — 폴더 열 때 Flask 실행 등
└── README.md               이 파일
```

**ZIP을 풀었을 때:** `…-main` 안에 또 `…-main`이 있으면, **`backend`와 `frontend`가 같은 레벨인 안쪽 폴더**를 엽니다.

---

## 요구 사항

- Python 3.x 권장  
- MySQL (`backend/.env`에 연결 정보; 없으면 DB 연동 기능만 제한될 수 있음)  
- (선택) 한국투자 오픈API 키, GPT(OpenAI) API 키 — `.env.example` 참고

---

## 설치

### 1. 가상환경 (권장)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

실행 정책 오류 시:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. 라이브러리

```powershell
cd backend
pip install -r requirements.txt
```

### 3. 환경 변수

`backend/.env.example` 을 복사해 `backend/.env` 로 저장한 뒤 값을 채웁니다.  
(MySQL, `FLASK_SECRET_KEY`, KIS, GPT(OpenAI), 모의투자 초기 자금 등 — 예제 파일 주석 참고.)

AI 분석 + 용어 설명을 함께 쓸 때 최소 예시:

```env
OPENAI_API_KEY=여기에_본인_GPT_키
```

---

## 서버 실행

```powershell
cd backend
python app.py
```

정상 시 예: `http://127.0.0.1:5000`

VS Code/Cursor에서는 작업 **「Flask: 주린닷컴 서버 실행」**(`backend/app.py`)을 쓸 수 있습니다.

**권장 접속:** `http://127.0.0.1:5000/주린닷컴홈피.html`  
같은 호스트(`:5000`)로 열어야 로그인 세션·모의투자 API 쿠키가 맞습니다. Live Server 등 다른 포트만 쓰면 일부 기능이 동작하지 않을 수 있습니다.

---

## 주요 페이지 (frontend)

| 파일 | 설명 |
|------|------|
| `주린닷컴홈피.html` | 메인, 티커 |
| `market.html` | 시세·종목 상세·차트 |
| `simulation.html` | 모의투자 |
| `analysis.html` | AI 종목 분석 (`/api/analyze`) |
| `glossary.html` | 용어 (`/api/terms/explain`) |

---

## API 요약

자세한 라우트는 `backend/app.py`의 `@app.route` 를 검색하면 됩니다.

### `POST /api/analyze`

종목 AI 분석.

```javascript
const response = await fetch('http://localhost:5000/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stock_name: '삼성전자' }),
});
```

응답 예시 필드: `success`, `stock_name`, `current_price`, `change_rate`, `opinion`, `summary`, `color` 등.

### `GET /api/health`

서버 상태 확인.

```json
{ "status": "ok", "message": "서버가 정상 작동 중입니다." }
```

### `POST /api/terms/explain`

용어 설명.

(GPT API 기반. `OPENAI_API_KEY` 또는 `GPT_API_KEY` 필요)

```json
{ "term": "PER" }
```

그 외: 실시간 시세 `/api/live-prices`, 지수 `/api/market-indices`, 모의투자 `/api/mock/*` 등.

---

## 분석·시세 참고 종목

예시: 삼성전자(005930), SK하이닉스(000660), NAVER(035420), 카카오(035720), 현대차(005380) 등.  
다른 종목은 코드·이름으로 조회 시도 가능합니다.

---

## 문제 해결

**포트 5000 사용 중**  
`backend/app.py` 마지막 `app.run(..., port=5000)` 을 `5001` 등으로 변경.

**CORS**  
`pip install Flask-CORS` 및 앱 설정 확인.

**yfinance 오류**  
네트워크 확인 후 `pip install --upgrade yfinance`.

**로그인·모의투자가 안 됨**  
브라우저에서 **`http://127.0.0.1:5000`** 으로 frontend를 열었는지 확인 (`file://` 또는 `:5500`만 쓰면 쿠키가 분리될 수 있음).

---

## 라이선스·면책

투자 판단은 사용자 책임이며, 본 프로젝트는 학습·데모 목적에 맞게 사용하세요.
