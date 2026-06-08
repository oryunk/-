USE stock_db;

-- 학습 가이드 보상 루미콘 해금 기록
CREATE TABLE IF NOT EXISTS user_lumicons (
  user_id     BIGINT NOT NULL,
  lumicon_id  VARCHAR(32) NOT NULL,
  unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lumicon_id),
  KEY idx_user_lumicon_user (user_id, unlocked_at DESC),
  CONSTRAINT fk_user_lumicon_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
