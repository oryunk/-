-- 기존 DB에만 실행 (이미 schema.sql 전체를 새로 깔았다면 생략)
ALTER TABLE news_articles
  ADD COLUMN reader_digest TEXT NULL AFTER summary;
