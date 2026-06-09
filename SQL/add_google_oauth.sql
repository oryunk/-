-- LEGACY: schema.sql(2026-06-09)에 병합됨. 신규 설치: python backend/scripts/migrate.py bootstrap
-- Google OAuth 로그인용 users 컬럼 (stock_db)
USE stock_db;

ALTER TABLE users
  ADD COLUMN google_sub VARCHAR(255) NULL COMMENT 'Google account sub (고유 ID)' AFTER nickname,
  ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local' COMMENT 'local|google' AFTER google_sub;

ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL COMMENT '소셜 전용 계정은 NULL 허용';

ALTER TABLE users
  ADD UNIQUE KEY uk_users_google_sub (google_sub);
