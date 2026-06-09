-- 기존 DB에 virtual_orders.tax_amount 가 없을 때 실행
-- LEGACY: schema.sql(2026-06-09)에 병합됨. 신규 설치: python backend/scripts/migrate.py bootstrap
ALTER TABLE virtual_orders
  ADD COLUMN tax_amount DECIMAL(18, 2) NOT NULL DEFAULT 0
  COMMENT '증권거래세 등(매도)' AFTER fee_amount;
