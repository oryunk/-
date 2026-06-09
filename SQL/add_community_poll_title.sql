-- LEGACY: schema.sql(2026-06-09)에 병합됨. 신규 설치: python backend/scripts/migrate.py bootstrap
USE stock_db;

ALTER TABLE community_post_polls
  ADD COLUMN IF NOT EXISTS title VARCHAR(100) NOT NULL DEFAULT '여러분의 생각은?' AFTER post_id;
