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
  
ALTER TABLE stocks 
ADD COLUMN current_price   DECIMAL(15,2) DEFAULT 0.00,   -- 현재가
ADD COLUMN change_amount  DECIMAL(15,2) DEFAULT 0.00,    -- 전일 대비 등락액
ADD COLUMN change_rate    DECIMAL(5,2)  DEFAULT 0.00,    -- 전일 대비 등락률
ADD COLUMN last_api_update DATETIME;                     -- 마지막 API 동기화 시간
  
  
  

  