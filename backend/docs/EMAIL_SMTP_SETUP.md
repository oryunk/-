# 회원가입 이메일 인증 — SMTP 설정 안내

## 받는 쪽 (가입자 이메일)

아래 주소로 **인증 메일을 받는 것**은 SMTP 발신만 설정되어 있으면 모두 가능합니다.

| 서비스 | 도메인 예시 |
|--------|-------------|
| 네이버 | `@naver.com` |
| 구글(Gmail) | `@gmail.com`, `@googlemail.com` |
| 다음·카카오 | `@daum.net`, `@hanmail.net`, `@kakao.com` |
| 네이트 | `@nate.com` |

가입 시 이메일 형식만 맞으면 됩니다. 별도 도메인 화이트리스트는 없습니다.

## 보내는 쪽 (서버 SMTP — `.env` 에 1개만 선택)

`backend/.env` 에 **실제로 메일을 보낼 계정 1개**의 SMTP 정보를 넣습니다.  
설정 후 Flask 서버를 **재시작**하세요.

필수 4항목: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`

---

### 1) 네이버 메일로 보내기

1. [네이버 메일](https://mail.naver.com) → **환경설정** → **POP3/IMAP 설정** → **SMTP 사용** 켜기  
2. `.env` 예시:

```env
SMTP_HOST=smtp.naver.com
SMTP_PORT=587
SMTP_USER=내아이디@naver.com
SMTP_PASSWORD=네이버메일비밀번호
SMTP_FROM=내아이디@naver.com
SMTP_USE_TLS=true
```

---

### 2) 구글(Gmail)로 보내기

1. Google 계정 **2단계 인증** 활성화  
2. [앱 비밀번호](https://myaccount.google.com/apppasswords) 생성 (메일 앱)  
3. `.env` 예시 (일반 비밀번호가 아니라 **앱 비밀번호**):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=내계정@gmail.com
SMTP_PASSWORD=16자리앱비밀번호
SMTP_FROM=내계정@gmail.com
SMTP_USE_TLS=true
```

---

### 3) 다음(daum) / 카카오 메일로 보내기

- **@daum.net**, **@hanmail.net** 계정: 다음 메일 SMTP  
- **@kakao.com** 계정: 카카오메일 설정 화면의 SMTP 안내를 따릅니다 (환경에 따라 `smtp.daum.net` 과 동일한 경우가 많음).

**다음 메일 (일반적인 설정)**

1. 다음 메일 → 환경설정 → **IMAP/SMTP 사용** 허용  
2. `.env` 예시 (465 SSL):

```env
SMTP_HOST=smtp.daum.net
SMTP_PORT=465
SMTP_USER=내아이디@daum.net
SMTP_PASSWORD=다음메일비밀번호
SMTP_FROM=내아이디@daum.net
SMTP_USE_TLS=false
```

TLS(587)가 안 되면 위처럼 `SMTP_USE_TLS=false` + 포트 `465` 를 사용하세요.

---

### 4) 네이트(nate) 메일로 보내기

1. 네이트 메일 → 설정 → **외부 메일 프로그램** / SMTP 사용 허용  
2. `.env` 예시:

```env
SMTP_HOST=smtp.mail.nate.com
SMTP_PORT=587
SMTP_USER=내아이디@nate.com
SMTP_PASSWORD=네이트메일비밀번호
SMTP_FROM=내아이디@nate.com
SMTP_USE_TLS=true
```

`smtp.nate.com` 로 안 되면 `smtp.mail.nate.com` 을 시도하세요.

---

## 기타

```env
EMAIL_CODE_TTL_MIN=10
EMAIL_CODE_RESEND_SEC=60
```

- `EMAIL_CODE_TTL_MIN`: 인증코드 유효 시간(분)  
- `EMAIL_CODE_RESEND_SEC`: 같은 이메일 재발송 대기(초)

## DB

최초 1회 MySQL에서 실행:

`SQL/add_email_verification.sql`

## 문제 해결

| 증상 | 확인 |
|------|------|
| SMTP가 설정되지 않았습니다 | `.env` 4항목이 비었는지, 서버 재시작 |
| 로그인 실패 | 앱 비밀번호(구글) / SMTP 사용 허용(네이버·다음·네이트) |
| 메일이 안 옴 | 스팸함, `SMTP_FROM` 과 `SMTP_USER` 일치 여부 |
| 테이블 없음 | `add_email_verification.sql` 적용 |
