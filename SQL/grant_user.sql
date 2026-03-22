USE stock_db;

-- 앱 전용 사용자 생성 (MySQL 8: 아래 한 줄. 이미 있으면 에러 → DROP USER 후 재실행하거나 이름 변경)
CREATE USER 'stock_app'@'localhost' IDENTIFIED BY 'wnflsdl1324';

-- stock_db 안의 모든 테이블에 대해 일반 CRUD (로그인·회원가입·모의투자 등)
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_db.* TO 'stock_app'@'localhost';

FLUSH PRIVILEGES;