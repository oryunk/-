-- LEGACY: schema.sql(2026-06-09)에 병합됨. 신규 설치: python backend/scripts/migrate.py bootstrap
-- 뉴스 기사별 AI 관련 종목 캐시 (JSON)
USE stock_db;

ALTER TABLE news_articles
  ADD COLUMN reader_related_stocks TEXT NULL COMMENT 'AI 관련종목 JSON 캐시' AFTER reader_digest;
