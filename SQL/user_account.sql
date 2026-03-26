Use stock_db;

DELIMITER //

CREATE TRIGGER trg_after_user_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    -- 가상 계좌 생성
    INSERT INTO virtual_accounts (
        user_id, 
        initial_cash, 
        cash_balance, 
        created_at, 
        updated_at
    ) VALUES (
        NEW.user_id, 
        1000000.00,  -- 초기 자금 100만원
        1000000.00,  
        NOW(), 
        NOW()
    );
END //

DELIMITER ;