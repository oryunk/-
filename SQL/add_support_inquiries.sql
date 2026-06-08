USE stock_db;

-- 문의 게시판
CREATE TABLE IF NOT EXISTS support_inquiries (
  inquiry_id   BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT NOT NULL,
  category     VARCHAR(30) NOT NULL COMMENT 'investment|service|payment|account|other',
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  status       ENUM('waiting', 'answered', 'resolved') NOT NULL DEFAULT 'waiting',
  is_private   TINYINT(1) NOT NULL DEFAULT 0,
  view_count   INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_support_inq_list (is_private, status, created_at DESC),
  KEY idx_support_inq_user (user_id, created_at DESC),
  KEY idx_support_inq_category (category),
  CONSTRAINT fk_support_inq_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_inquiry_replies (
  reply_id     BIGINT PRIMARY KEY AUTO_INCREMENT,
  inquiry_id   BIGINT NOT NULL,
  admin_name   VARCHAR(80) NOT NULL DEFAULT '주린닷컴 고객센터',
  body         TEXT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_support_reply_inquiry (inquiry_id, created_at ASC),
  CONSTRAINT fk_support_reply_inquiry FOREIGN KEY (inquiry_id) REFERENCES support_inquiries(inquiry_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_inquiry_feedback (
  inquiry_id   BIGINT NOT NULL,
  user_id      BIGINT NOT NULL,
  helpful      TINYINT(1) NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inquiry_id, user_id),
  CONSTRAINT fk_support_fb_inquiry FOREIGN KEY (inquiry_id) REFERENCES support_inquiries(inquiry_id) ON DELETE CASCADE,
  CONSTRAINT fk_support_fb_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 시드: users 테이블에 1명 이상 있어야 합니다.
SET @seed_uid := (SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1);

INSERT INTO support_inquiries (user_id, category, title, body, status, is_private, view_count, created_at)
SELECT @seed_uid, 'service', '모의투자 잔고가 반영되지 않아요', '어제 매수한 종목이 포트폴리오에 보이지 않습니다. 새로고침을 해도 동일합니다.', 'answered', 0, 42, DATE_SUB(NOW(), INTERVAL 5 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM support_inquiries WHERE title = '모의투자 잔고가 반영되지 않아요' LIMIT 1);

INSERT INTO support_inquiries (user_id, category, title, body, status, is_private, view_count, created_at)
SELECT @seed_uid, 'investment', 'AI 분석 결과는 참고만 하면 되나요?', 'AI 분석 점수가 높은 종목을 그대로 매수해도 괜찮은지 궁금합니다.', 'answered', 0, 87, DATE_SUB(NOW(), INTERVAL 4 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM support_inquiries WHERE title = 'AI 분석 결과는 참고만 하면 되나요?' LIMIT 1);

INSERT INTO support_inquiries (user_id, category, title, body, status, is_private, view_count, created_at)
SELECT @seed_uid, 'payment', '유료 서비스 환불 문의', '결제 후 3일 이내 환불 가능 여부를 확인하고 싶습니다.', 'waiting', 1, 3, DATE_SUB(NOW(), INTERVAL 2 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM support_inquiries WHERE title = '유료 서비스 환불 문의' LIMIT 1);

INSERT INTO support_inquiries (user_id, category, title, body, status, is_private, view_count, created_at)
SELECT @seed_uid, 'account', '닉네임 변경이 안 됩니다', '마이페이지에서 닉네임을 수정하려고 하면 오류가 발생합니다.', 'waiting', 0, 15, DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM support_inquiries WHERE title = '닉네임 변경이 안 됩니다' LIMIT 1);

INSERT INTO support_inquiries (user_id, category, title, body, status, is_private, view_count, created_at)
SELECT @seed_uid, 'other', '제휴/광고 문의', '금융 콘텐츠 제휴 가능 여부를 알고 싶습니다.', 'resolved', 0, 31, DATE_SUB(NOW(), INTERVAL 7 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM support_inquiries WHERE title = '제휴/광고 문의' LIMIT 1);

INSERT INTO support_inquiries (user_id, category, title, body, status, is_private, view_count, created_at)
SELECT @seed_uid, 'service', '시장 LIVE 시세 지연 문의', '시장 페이지에서 일부 종목 시세가 1~2분 늦게 보입니다.', 'answered', 0, 56, DATE_SUB(NOW(), INTERVAL 3 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM support_inquiries WHERE title = '시장 LIVE 시세 지연 문의' LIMIT 1);

INSERT INTO support_inquiries (user_id, category, title, body, status, is_private, view_count, created_at)
SELECT @seed_uid, 'investment', '초보자 추천 학습 순서', '가이드와 모의투자 중 어디부터 시작하면 좋을까요?', 'waiting', 0, 9, DATE_SUB(NOW(), INTERVAL 6 HOUR)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM support_inquiries WHERE title = '초보자 추천 학습 순서' LIMIT 1);

INSERT INTO support_inquiry_replies (inquiry_id, admin_name, body, created_at)
SELECT i.inquiry_id, '주린닷컴 고객센터',
  '안녕하세요. 모의투자 잔고는 체결 후 약 1~2초 내 반영됩니다. 브라우저 캐시를 비우고 다시 로그인해 보시고, 동일하면 문의 번호와 함께 다시 알려주세요.',
  DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM support_inquiries i
WHERE i.title = '모의투자 잔고가 반영되지 않아요'
  AND NOT EXISTS (SELECT 1 FROM support_inquiry_replies r WHERE r.inquiry_id = i.inquiry_id LIMIT 1);

INSERT INTO support_inquiry_replies (inquiry_id, admin_name, body, created_at)
SELECT i.inquiry_id, '주린닷컴 고객센터',
  'AI 분석은 학습·참고용 정보입니다. 투자 판단과 최종 책임은 이용자 본인에게 있으며, 분산투자와 리스크 관리를 함께 고려해 주세요.',
  DATE_SUB(NOW(), INTERVAL 3 DAY)
FROM support_inquiries i
WHERE i.title = 'AI 분석 결과는 참고만 하면 되나요?'
  AND NOT EXISTS (SELECT 1 FROM support_inquiry_replies r WHERE r.inquiry_id = i.inquiry_id LIMIT 1);

INSERT INTO support_inquiry_replies (inquiry_id, admin_name, body, created_at)
SELECT i.inquiry_id, '주린닷컴 고객센터',
  '제휴 문의 감사합니다. 담당자가 영업일 기준 2~3일 내 이메일로 회신드리겠습니다.',
  DATE_SUB(NOW(), INTERVAL 6 DAY)
FROM support_inquiries i
WHERE i.title = '제휴/광고 문의'
  AND NOT EXISTS (SELECT 1 FROM support_inquiry_replies r WHERE r.inquiry_id = i.inquiry_id LIMIT 1);

INSERT INTO support_inquiry_replies (inquiry_id, admin_name, body, created_at)
SELECT i.inquiry_id, '주린닷컴 고객센터',
  '시장 LIVE는 거래소·API 지연에 따라 차이가 날 수 있습니다. 새로고침 후에도 동일하면 종목 코드와 시간을 알려주시면 확인하겠습니다.',
  DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM support_inquiries i
WHERE i.title = '시장 LIVE 시세 지연 문의'
  AND NOT EXISTS (SELECT 1 FROM support_inquiry_replies r WHERE r.inquiry_id = i.inquiry_id LIMIT 1);
