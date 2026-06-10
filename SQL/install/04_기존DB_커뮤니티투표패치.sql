-- 기존 DB(예전 schema + add_community_polls.sql 만 적용)용 커뮤니티 투표 패치
-- Workbench: stock_db 선택 → 이 파일 Execute (여러 번 실행해도 안전)
-- 선행: community_post_polls, community_poll_votes 테이블이 있어야 함 (add_community_polls.sql)
USE stock_db;

-- ── 1) community_poll_options ───────────────────────────────
CREATE TABLE IF NOT EXISTS community_poll_options (
  option_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  poll_id    BIGINT NOT NULL,
  label      VARCHAR(50) NOT NULL,
  icon_type  ENUM('rise','fall','custom') NOT NULL DEFAULT 'custom',
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_community_poll_option_poll (poll_id),
  CONSTRAINT fk_community_poll_option_poll FOREIGN KEY (poll_id) REFERENCES community_post_polls(poll_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2) community_post_polls.title ───────────────────────────
SET @has_poll_title := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_post_polls'
    AND COLUMN_NAME = 'title'
);

SET @sql_add_poll_title := IF(
  @has_poll_title = 0,
  'ALTER TABLE community_post_polls ADD COLUMN title VARCHAR(100) NOT NULL DEFAULT ''여러분의 생각은?'' AFTER post_id',
  'SELECT 1'
);
PREPARE stmt_add_poll_title FROM @sql_add_poll_title;
EXECUTE stmt_add_poll_title;
DEALLOCATE PREPARE stmt_add_poll_title;

-- ── 3) community_poll_votes: choice → option_id ─────────────
SET @has_choice := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_poll_votes'
    AND COLUMN_NAME = 'choice'
);

SET @has_option := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_poll_votes'
    AND COLUMN_NAME = 'option_id'
);

SET @sql_add_option := IF(
  @has_option = 0,
  'ALTER TABLE community_poll_votes ADD COLUMN option_id BIGINT NULL AFTER user_id',
  'SELECT 1'
);
PREPARE stmt_add_option FROM @sql_add_option;
EXECUTE stmt_add_option;
DEALLOCATE PREPARE stmt_add_option;

-- choice 컬럼이 남아 있으면 데이터 이전 (option_id 컬럼이 이미 있어도 실행)
SET @do_vote_migrate := IF(@has_choice > 0, 1, 0);
SET SQL_SAFE_UPDATES = 0;

UPDATE community_poll_votes v
JOIN community_poll_options o
  ON o.poll_id = v.poll_id
 AND o.icon_type = v.choice
SET v.option_id = o.option_id
WHERE @do_vote_migrate = 1
  AND v.vote_id > 0
  AND v.option_id IS NULL;

DELETE FROM community_poll_votes
WHERE @do_vote_migrate = 1
  AND vote_id > 0
  AND option_id IS NULL;

SET SQL_SAFE_UPDATES = 1;

SET @sql_drop_choice := IF(
  @has_choice > 0,
  'ALTER TABLE community_poll_votes DROP COLUMN choice',
  'SELECT 1'
);
PREPARE stmt_drop_choice FROM @sql_drop_choice;
EXECUTE stmt_drop_choice;
DEALLOCATE PREPARE stmt_drop_choice;

SET @has_choice_after := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_poll_votes'
    AND COLUMN_NAME = 'choice'
);

SET @has_option_after := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_poll_votes'
    AND COLUMN_NAME = 'option_id'
);

SET @sql_modify_option := IF(
  @has_option_after > 0 AND @has_choice_after = 0,
  'ALTER TABLE community_poll_votes MODIFY COLUMN option_id BIGINT NOT NULL',
  'SELECT 1'
);
PREPARE stmt_modify_option FROM @sql_modify_option;
EXECUTE stmt_modify_option;
DEALLOCATE PREPARE stmt_modify_option;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_poll_votes'
    AND CONSTRAINT_NAME = 'fk_community_poll_vote_option'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql_add_fk := IF(
  @fk_exists = 0 AND (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'community_poll_votes'
      AND COLUMN_NAME = 'option_id'
  ) > 0,
  'ALTER TABLE community_poll_votes ADD CONSTRAINT fk_community_poll_vote_option FOREIGN KEY (option_id) REFERENCES community_poll_options(option_id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_fk FROM @sql_add_fk;
EXECUTE stmt_add_fk;
DEALLOCATE PREPARE stmt_add_fk;

-- 확인용 (선택)
-- SHOW TABLES LIKE 'community_poll%';
-- DESCRIBE community_post_polls;
-- DESCRIBE community_poll_options;
-- DESCRIBE community_poll_votes;
