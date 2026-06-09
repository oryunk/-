-- LEGACY: schema.sql(2026-06-09)에 병합됨. 신규 설치: python backend/scripts/migrate.py bootstrap
USE stock_db;

-- 시세 스냅샷·시장폭 조회 성능 보조 인덱스 (이미 UNIQUE(stock_id, date) 가 있으면 stock_id 조회는 커버됨)
-- 최근 거래일 목록(ORDER BY date DESC LIMIT N) 가 느릴 때만 적용

-- 이미 있으면 오류 무시하고 넘어가도 됨
CREATE INDEX idx_stock_price_daily_date ON stock_price_daily (date);

-- stock_popularity 유니버스 조회 보조 (선택)
CREATE INDEX idx_stock_popularity_date_stock ON stock_popularity (date, stock_id);
