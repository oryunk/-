-- 종목 상세 API(/api/stock-detail) 응답 스냅샷 캐시. stock_db에 적용.
CREATE TABLE IF NOT EXISTS stock_detail_snapshots (
  cache_key VARCHAR(384) NOT NULL COMMENT 'code:name 요청 키',
  stock_code CHAR(6) NOT NULL,
  payload_json LONGTEXT NOT NULL COMMENT 'detail dict JSON',
  fetched_at DATETIME NOT NULL,
  PRIMARY KEY (cache_key),
  KEY idx_sds_stock_fetched (stock_code, fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
