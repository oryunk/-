Use stock_db;

-- [1] 회원 가입 시 자동 계좌 생성 트리거
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

-- [2] 주식 매수 체결 프로시저 (잔액 차감 + 포지션 추가/갱신)
DELIMITER //
CREATE PROCEDURE proc_execute_buy_order(
    IN p_user_id BIGINT,
    IN p_stock_id BIGINT,
    IN p_quantity INT,
    IN p_price DECIMAL(18,2)
)
BEGIN
    DECLARE v_total_cost DECIMAL(18,2);
    DECLARE v_account_id BIGINT;
    
    SET v_total_cost = p_price * p_quantity;
    SELECT account_id INTO v_account_id FROM virtual_accounts WHERE user_id = p_user_id;

    -- 1. 잔액 확인 및 차감 (돈이 모자라면 실행 안 됨)
    UPDATE virtual_accounts 
    SET cash_balance = cash_balance - v_total_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id AND cash_balance >= v_total_cost;

    -- 2. 실제 차감이 일어났을 때만 주식 입고 (Row_count 확인)
    IF ROW_COUNT() > 0 THEN
        INSERT INTO virtual_positions (account_id, stock_id, quantity, avg_price, updated_at)
        VALUES (v_account_id, p_stock_id, p_quantity, p_price, NOW())
        ON DUPLICATE KEY UPDATE 
            avg_price = (avg_price * quantity + p_price * p_quantity) / (quantity + p_quantity),
            quantity = quantity + p_quantity,
            updated_at = NOW();
            
        -- 3. 주문 이력 남기기
        INSERT INTO virtual_orders (account_id, stock_id, side, price, quantity, status, fee_amount, executed_at, created_at)
        VALUES (v_account_id, p_stock_id, 'BUY', p_price, p_quantity, 'EXECUTED', 0, NOW(), NOW());
    END IF;
END //
DELIMITER ;