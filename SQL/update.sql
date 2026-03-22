USE stock_db;

ALTER TABLE users
  ADD COLUMN login_id VARCHAR(50) NULL COMMENT '로그인 아이디' AFTER user_id;

UPDATE users
SET login_id = CONCAT('user_', user_id)
WHERE login_id IS NULL;

ALTER TABLE users
  MODIFY COLUMN login_id VARCHAR(50) NOT NULL COMMENT '로그인 아이디';

ALTER TABLE users
  ADD UNIQUE KEY uk_users_login_id (login_id);
  

  