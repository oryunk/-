# Google OAuth (웹 로그인) 설정

KIS `tokenP` 등 **서버 API 토큰**과 별개입니다. 사용자가 **Google로 로그인/가입**할 때만 사용합니다.

## 동작 요약

| 상황 | 앱 동작 |
|------|---------|
| DB에 유저 없음 (전체 wipe 후) | Google `sub`로 **신규 회원** INSERT. 앱에 "연동하시겠습니까?" 화면 **없음**. |
| 같은 이메일로 **로컬 가입** 이미 있음 + Google `email_verified` | 백엔드가 `google_sub` **자동 연동** (`UPDATE`). |
| 이메일 충돌·미인증 등 | 홈으로 `?login_error=google_account` 리다이렉트. |

프론트는 **같은 탭**에서 `{API}/api/auth/google/start` 로 이동합니다 (팝업/새 창 아님).

## 1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → **OAuth 동의 화면**  
   - 테스트 모드면 **테스트 사용자**에 로그인할 Gmail을 반드시 추가합니다.  
   - 미등록 계정은 Google 화면에서 **403 / 접근 불가**가 날 수 있습니다.

2. **사용자 인증 정보** → OAuth 2.0 클라이언트 ID → **웹 애플리케이션**

3. **승인된 리디렉션 URI** — `backend/.env`의 `GOOGLE_REDIRECT_URI`와 **문자 단위 동일**하게 등록합니다.

   로컬·AWS를 둘 다 쓰면 **URI를 각각 등록**하고, **서버마다 `.env`의 `GOOGLE_REDIRECT_URI`를 그 서버용 하나**로 맞춥니다.

   | 환경 | 등록 예시 (실제 호스트에 맞게) |
   |------|--------------------------------|
   | 로컬 (`127.0.0.1`) | `http://127.0.0.1:5000/api/auth/google/callback` |
   | 로컬 (`localhost`) | `http://localhost:5000/api/auth/google/callback` |
   | AWS (Flask :5000 직접) | `http://{공인IP}:5000/api/auth/google/callback` |
   | AWS (nginx가 `/api` 프록시) | `https://{도메인}/api/auth/google/callback` |

   주의: `http` vs `https`, `localhost` vs `127.0.0.1`, 포트, 경로 `/api/auth/google/callback` 한 글자라도 다르면 **Google 403**이 납니다.

## 2. `backend/.env`

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=....
GOOGLE_REDIRECT_URI=http://127.0.0.1:5000/api/auth/google/callback
GOOGLE_LOGIN_SUCCESS_URL=/주린닷컴홈피.html
```

- **로컬 `.env`**와 **AWS `.env`**는 각각 해당 서버의 callback URL을 씁니다.
- `GOOGLE_LOGIN_SUCCESS_URL`은 로그인 성공 후 Flask가 리다이렉트하는 경로입니다.

## 3. 설정 확인 (리디렉션 URI 대조)

Flask 실행 후:

```text
GET http://127.0.0.1:5000/api/auth/google/status
```

응답의 `redirect_uri`가 Console **승인된 리디렉션 URI**와 동일한지 확인합니다.

또는 브라우저에서 `GET /api/auth/google/start`로 이동한 뒤, 주소창이 `accounts.google.com`으로 바뀌기 **직전** 또는 Google URL의 `redirect_uri=` 쿼리를 디코딩해 비교합니다.

터미널:

```powershell
cd backend
python scripts/check_google_oauth_env.py
```

## 4. Google 403 ("페이지에 액세스할 수 없습니다")

| 원인 | 조치 |
|------|------|
| 리디렉션 URI 불일치 | Console URI ↔ `.env` `GOOGLE_REDIRECT_URI` ↔ `/api/auth/google/status`의 `redirect_uri` 일치 |
| 테스트 모드 + 비테스트 Gmail | 동의 화면 → 테스트 사용자에 Gmail 추가 |
| AWS에서 로컬 URI만 설정 | AWS `.env`를 공인 URL callback으로 변경 후 Console에도 등록 |
| Live Server `:5500`만 사용 | **`http://127.0.0.1:5000/...`** 로 Flask에서 HTML 열기 (세션·OAuth state 쿠키) |

CSS/UI 변경만으로는 Google 403이 나지 않습니다. Google 버튼에 `target="_blank"`를 넣으면 `google_state` 오류가 날 수 있으나, 그 경우는 **우리 앱** 리다이렉트이지 Google 403이 아닙니다.

## 5. 유저 전체 삭제(wipe) 후 Google 가입

Git push만으로 DB는 바뀌지 않습니다. AWS/로컬 DB에서 순서대로 확인:

1. **Google 컬럼** — [`SQL/add_google_oauth.sql`](../../SQL/add_google_oauth.sql) 적용 여부  
2. **가입 트리거(모의계좌 500만)** — [`SQL/user_account.sql`](../../SQL/user_account.sql)의 `[1] 트리거` 재실행  
3. wipe 스크립트 실행 후 — [`SQL/google_oauth_post_wipe_check.sql`](../../SQL/google_oauth_post_wipe_check.sql)로 신규 Google 유저·`virtual_accounts` 확인

## 6. (선택) 명시적 "연동" UI

현재는 구현되어 있지 않습니다. 로컬 가입 후 같은 이메일 Google 로그인 시 **자동 연동** 또는 `google_account` 오류만 있습니다. 별도 확인 화면이 필요하면 제품 요구로 추가 개발이 필요합니다.
