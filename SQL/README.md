# stock_db SQL 가이드

## MySQL Workbench만 쓸 때 (추천)

**[`install/README.md`](install/README.md)** — 실행할 파일이 `SQL/install/` 한곳에 모여 있습니다.

1. `01_필수_테이블전체.sql`
2. `02_필수_트리거프로시저.sql`
3. (선택) `03_선택_종목데이터.sql`, `install/선택_시드/`

`add_*.sql`, `migrations/` 는 **새 설치 시 실행하지 않습니다.**

---

## 빠른 시작 (신규 DB · migrate.py)

```powershell
cd backend
# .env 에 MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE 설정
python scripts/migrate.py bootstrap --seeds
```

이 명령은 다음을 순서대로 실행합니다.

1. [`schema.sql`](schema.sql) — 29개 테이블 전체 DDL
2. [`user_account.sql`](user_account.sql) — 가입 시 모의계좌 트리거·매수 프로시저
3. [`migrations/manifest.txt`](migrations/manifest.txt) 전체를 적용 완료로 기록
4. (선택) [`seeds/`](seeds/) — 커뮤니티·고객센터 데모 데이터

## 기존 DB 업그레이드

`schema.sql`을 **다시 실행하지 마세요** (테이블 중복 오류).

```powershell
cd backend
python scripts/migrate.py status    # 적용 여부 확인
python scripts/migrate.py migrate     # 미적용 migration만 실행
```

## 앞으로 스키마를 바꿀 때

1. [`schema.sql`](schema.sql)에 최신 DDL 반영 (신규 설치용 스냅샷)
2. [`migrations/00N_설명.sql`](migrations/) 파일 추가
3. [`migrations/manifest.txt`](migrations/manifest.txt)에 파일명 한 줄 추가
4. `python scripts/migrate.py migrate` 실행

## 파일 역할

| 파일/폴더 | 용도 |
|-----------|------|
| `schema.sql` | 최신 전체 DDL 스냅샷 (bootstrap 시 사용) |
| `user_account.sql` | 트리거·저장 프로시저 (DDL과 별도) |
| `migrations/` | 순서 있는 증분 변경 + `schema_migrations` 추적 |
| `seeds/` | 데모 데이터 (선택) |
| `stocks_symbol_data.sql` | KOSPI 종목 시드 (선택, 수동 실행) |
| `grant_user.sql` | MySQL 계정 생성 (운영 환경별, 수동) |
| `wipe_all_users.sql` | 전체 회원 삭제 (개발용) |
| `add_*.sql`, `update.sql` | **LEGACY** — 기존 DB 수동 패치 참고용 |

## `schema.sql`만으로 충분한가?

**아니요.** 최소한 아래가 추가로 필요합니다.

- **트리거/프로시저:** `user_account.sql` (또는 `migrate.py bootstrap`)
- **증분 변경:** 기존 DB는 `migrate.py migrate`
- **선택:** `seeds/`, `stocks_symbol_data.sql`

일상적인 DB 작업의 진입점은 **`python backend/scripts/migrate.py`** 입니다.

## 전체 회원 삭제 (개발/테스트)

```powershell
python backend/scripts/wipe_all_users.py
```

또는 `mysql ... < SQL/wipe_all_users.sql`

## 테이블 목록 (29)

`users`, `email_verification_codes`, `stocks`, `stock_price_daily`, `stock_popularity`, `stock_detail_snapshots`, `user_watchlist`, `virtual_accounts`, `virtual_positions`, `virtual_orders`, `ai_analyses`, `news_articles`, `news_stock_rel`, `stock_terms`, `api_tokens`, `lumi_chat_threads`, `lumi_chat_messages`, `user_lumicons`, `community_posts`, `community_post_likes`, `community_comments`, `community_post_attachments`, `community_post_polls`, `community_poll_options`, `community_poll_votes`, `support_inquiries`, `support_inquiry_replies`, `support_inquiry_feedback`, `support_inquiry_attachments`
