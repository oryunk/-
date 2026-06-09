-- Legacy DB upgrade: community_poll_votes.choice -> option_id
-- Skip automatically if option_id already exists (fresh schema.sql installs).
USE stock_db;

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
  @has_choice > 0 AND @has_option = 0,
  'ALTER TABLE community_poll_votes ADD COLUMN option_id BIGINT NULL AFTER user_id',
  'SELECT 1'
);
PREPARE stmt_add_option FROM @sql_add_option;
EXECUTE stmt_add_option;
DEALLOCATE PREPARE stmt_add_option;

UPDATE community_poll_votes v
JOIN community_poll_options o
  ON o.poll_id = v.poll_id
 AND o.icon_type = v.choice
SET v.option_id = o.option_id
WHERE @has_choice > 0
  AND @has_option = 0
  AND v.option_id IS NULL;

DELETE FROM community_poll_votes
WHERE @has_choice > 0
  AND @has_option = 0
  AND option_id IS NULL;

SET @sql_drop_choice := IF(
  @has_choice > 0 AND @has_option = 0,
  'ALTER TABLE community_poll_votes DROP COLUMN choice',
  'SELECT 1'
);
PREPARE stmt_drop_choice FROM @sql_drop_choice;
EXECUTE stmt_drop_choice;
DEALLOCATE PREPARE stmt_drop_choice;

SET @sql_modify_option := IF(
  @has_choice > 0 AND @has_option = 0,
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
