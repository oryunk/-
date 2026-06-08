-- Google OAuth / wipe 후 점검용 (읽기 전용 SELECT)
-- add_google_oauth.sql, user_account.sql [1] 트리거 적용 후 실행

USE stock_db;

-- google_sub, auth_provider 컬럼 존재 여부 (없으면 1054 오류 → add_google_oauth.sql 실행)
SELECT user_id, login_id, email, auth_provider, google_sub IS NOT NULL AS has_google_sub
FROM users
ORDER BY user_id DESC
LIMIT 10;

-- 가입 트리거로 생성된 모의계좌 (신규 Google 가입 직후 1행 기대)
SELECT u.user_id, u.auth_provider, va.account_id, va.cash_balance
FROM users u
LEFT JOIN virtual_accounts va ON va.user_id = u.user_id
WHERE u.auth_provider = 'google'
ORDER BY u.user_id DESC
LIMIT 10;
