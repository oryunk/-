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

-- stock_price_daily 에 전일 종가 컬럼 추가
-- 등락률 계산 시 "이전 일자 close_price" 서브쿼리 폴백 대신
-- 행 자체에 들어있는 prev_close 를 우선 사용하기 위함.
-- (KIS 응답의 stck_sdpr / stck_prdy_clpr 가 시세 동기화 시 같이 저장됨)
ALTER TABLE stock_price_daily
  ADD COLUMN prev_close DECIMAL(15,2) NULL AFTER close_price;
