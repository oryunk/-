-- 기존 DB에만 실행 (이미 schema.sql 전체를 새로 깔았다면 생략)
-- LEGACY: schema.sql(2026-06-09)에 병합됨. 신규 설치: python backend/scripts/migrate.py bootstrap
ALTER TABLE news_articles
  ADD COLUMN reader_digest TEXT NULL AFTER summary;
