-- LEGACY: schema.sql(2026-06-09)에 병합됨. 신규 설치: python backend/scripts/migrate.py bootstrap
USE stock_db;

CREATE TABLE IF NOT EXISTS community_poll_options (
  option_id   BIGINT PRIMARY KEY AUTO_INCREMENT,
  poll_id     BIGINT NOT NULL,
  label       VARCHAR(50) NOT NULL,
  icon_type   ENUM('rise','fall','custom') NOT NULL DEFAULT 'custom',
  sort_order  INT NOT NULL DEFAULT 0,
  KEY idx_community_poll_option_poll (poll_id),
  CONSTRAINT fk_community_poll_option_poll FOREIGN KEY (poll_id) REFERENCES community_post_polls(poll_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
