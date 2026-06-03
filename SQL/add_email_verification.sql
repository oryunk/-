-- 이메일 회원가입 인증코드 (signup 시 검증)
USE stock_db;

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_email_created (email, created_at)
);
