-- [Workbench] SQL/install/01 — 필수 (빈 DB에 1회만 실행)
-- 원본: SQL/schema.sql (내용 동일 복사본)
-- stock_db 전체 스키마 (29 tables). 이미 테이블 있으면 실행하지 마세요.

CREATE DATABASE IF NOT EXISTS stock_db;
USE stock_db;

-- ── 1. 사용자 ──────────────────────────────────────────────
CREATE TABLE users (
  user_id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  login_id           VARCHAR(50)  NOT NULL COMMENT '로그인 아이디',
  email              VARCHAR(100) NOT NULL,
  password_hash      VARCHAR(255) NULL COMMENT '소셜 전용 계정은 NULL 허용',
  nickname           VARCHAR(50)  NOT NULL,
  profile_image_path VARCHAR(255) NULL COMMENT '프로필 이미지 저장 경로',
  google_picture_url VARCHAR(500) NULL COMMENT 'Google 계정 프로필 사진 URL',
  google_sub         VARCHAR(255) NULL COMMENT 'Google account sub',
  auth_provider      VARCHAR(20)  NOT NULL DEFAULT 'local' COMMENT 'local|google',
  created_at         DATETIME     NOT NULL,
  updated_at         DATETIME     NOT NULL,
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_login_id (login_id),
  UNIQUE KEY uk_users_google_sub (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_verification_codes (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(100) NOT NULL,
  code_hash  VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_email_created (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. 종목 / 시세 / 인기 ────────────────────────────────────
CREATE TABLE stocks (
  stock_id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  symbol          VARCHAR(20)  NOT NULL,
  name_ko         VARCHAR(100) NOT NULL,
  name_en         VARCHAR(100),
  market          VARCHAR(20),
  sector          VARCHAR(50),
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  current_price   DECIMAL(15,2) DEFAULT 0.00,
  change_amount   DECIMAL(15,2) DEFAULT 0.00,
  change_rate     DECIMAL(5,2)  DEFAULT 0.00,
  last_api_update DATETIME,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  UNIQUE KEY uk_stocks_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_price_daily (
  price_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
  stock_id    BIGINT NOT NULL,
  date        DATE   NOT NULL,
  open_price  DECIMAL(15,2),
  high_price  DECIMAL(15,2),
  low_price   DECIMAL(15,2),
  close_price DECIMAL(15,2),
  prev_close  DECIMAL(15,2) NULL,
  volume      BIGINT,
  created_at  DATETIME NOT NULL,
  UNIQUE KEY uk_stock_price_daily (stock_id, date),
  INDEX idx_stock_price_daily_date (date),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_popularity (
  popularity_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  stock_id      BIGINT NOT NULL,
  date          DATE   NOT NULL,
  view_count    INT    NOT NULL DEFAULT 0,
  search_count  INT    NOT NULL DEFAULT 0,
  trade_count   INT    NOT NULL DEFAULT 0,
  UNIQUE KEY uk_stock_popularity (stock_id, date),
  INDEX idx_stock_popularity_date_stock (date, stock_id),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_detail_snapshots (
  cache_key    VARCHAR(384) NOT NULL COMMENT 'code:name 요청 키',
  stock_code   CHAR(6)      NOT NULL,
  payload_json LONGTEXT     NOT NULL COMMENT 'detail dict JSON',
  fetched_at   DATETIME     NOT NULL,
  PRIMARY KEY (cache_key),
  KEY idx_sds_stock_fetched (stock_code, fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_watchlist (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT NOT NULL,
  stock_id   BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_watchlist (user_id, stock_id),
  KEY idx_user_watchlist_user_created (user_id, created_at DESC),
  CONSTRAINT fk_uw_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_uw_stock FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. 모의투자 ─────────────────────────────────────────────
CREATE TABLE virtual_accounts (
  account_id   BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT NOT NULL,
  initial_cash DECIMAL(18,2) NOT NULL,
  cash_balance DECIMAL(18,2) NOT NULL,
  created_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL,
  UNIQUE KEY uk_virtual_accounts_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE virtual_positions (
  position_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  account_id  BIGINT NOT NULL,
  stock_id    BIGINT NOT NULL,
  quantity    INT    NOT NULL,
  avg_price   DECIMAL(18,2) NOT NULL,
  updated_at  DATETIME NOT NULL,
  UNIQUE KEY uk_virtual_positions (account_id, stock_id),
  FOREIGN KEY (account_id) REFERENCES virtual_accounts(account_id),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE virtual_orders (
  order_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
  account_id  BIGINT NOT NULL,
  stock_id    BIGINT NOT NULL,
  side        ENUM('BUY','SELL') NOT NULL,
  price       DECIMAL(18,2) NOT NULL,
  quantity    INT NOT NULL,
  status      ENUM('EXECUTED','CANCELED') NOT NULL,
  fee_amount  DECIMAL(18,2) NOT NULL,
  tax_amount  DECIMAL(18,2) NOT NULL DEFAULT 0,
  executed_at DATETIME NOT NULL,
  created_at  DATETIME NOT NULL,
  FOREIGN KEY (account_id) REFERENCES virtual_accounts(account_id),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id),
  INDEX idx_virtual_orders_account_created (account_id, created_at),
  INDEX idx_virtual_orders_account_stock_created (account_id, stock_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. AI 분석 ────────────────────────────────────────────────
CREATE TABLE ai_analyses (
  analysis_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT,
  stock_id    BIGINT,
  target_type ENUM('STOCK','MARKET') NOT NULL,
  target_key  VARCHAR(50),
  rating      VARCHAR(50) NOT NULL,
  per_text    VARCHAR(50),
  summary     TEXT NOT NULL,
  created_at  DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. 뉴스 ───────────────────────────────────────────────────
CREATE TABLE news_articles (
  news_id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  title                 VARCHAR(255) NOT NULL,
  summary               TEXT,
  reader_digest         TEXT NULL,
  reader_related_stocks TEXT NULL COMMENT 'AI 관련종목 JSON 캐시',
  url                   VARCHAR(500) NOT NULL,
  guid                  VARCHAR(255),
  img_url               VARCHAR(500),
  category              VARCHAR(50),
  source                VARCHAR(100) NOT NULL,
  published_at          DATETIME NOT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fetched_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_news_url (url),
  UNIQUE KEY uq_news_guid (source, guid),
  INDEX idx_news_published (published_at),
  INDEX idx_news_category_published (category, published_at),
  FULLTEXT KEY ft_news_title_summary (title, summary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE news_stock_rel (
  news_id    BIGINT NOT NULL,
  stock_id   BIGINT NOT NULL,
  match_type ENUM('MANUAL','TICKER','NLP') NOT NULL DEFAULT 'NLP',
  confidence DECIMAL(5,4),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (news_id, stock_id),
  INDEX idx_news_stock (stock_id, news_id),
  FOREIGN KEY (news_id) REFERENCES news_articles(news_id),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. 용어사전 ───────────────────────────────────────────────
CREATE TABLE stock_terms (
  term_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
  term       VARCHAR(100) NOT NULL,
  full_name  VARCHAR(255),
  definition TEXT NOT NULL,
  example    TEXT,
  category   VARCHAR(50),
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 7. API 토큰 ───────────────────────────────────────────────
CREATE TABLE api_tokens (
  token_id     INT PRIMARY KEY AUTO_INCREMENT,
  token_type   VARCHAR(20) NOT NULL,
  access_token TEXT NOT NULL,
  expired_at   DATETIME NOT NULL,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 8. 루미 AI 챗 ─────────────────────────────────────────────
CREATE TABLE lumi_chat_threads (
  thread_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT NOT NULL,
  title      VARCHAR(120) NOT NULL DEFAULT '새 대화',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lumi_threads_user_updated (user_id, updated_at DESC),
  CONSTRAINT fk_lumi_thread_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lumi_chat_messages (
  message_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  thread_id  BIGINT NOT NULL,
  role       ENUM('user', 'assistant') NOT NULL,
  content    TEXT NOT NULL,
  mood       VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_lumi_messages_thread_created (thread_id, created_at ASC),
  CONSTRAINT fk_lumi_msg_thread FOREIGN KEY (thread_id) REFERENCES lumi_chat_threads(thread_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 9. 학습 가이드 루미콘 ─────────────────────────────────────
CREATE TABLE user_lumicons (
  user_id     BIGINT NOT NULL,
  lumicon_id  VARCHAR(32) NOT NULL,
  unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lumicon_id),
  KEY idx_user_lumicon_user (user_id, unlocked_at DESC),
  CONSTRAINT fk_user_lumicon_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 10. 커뮤니티 ──────────────────────────────────────────────
CREATE TABLE community_posts (
  post_id       BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT NOT NULL,
  board         VARCHAR(20) NOT NULL COMMENT 'free|qna|stock|proof',
  title         VARCHAR(200) NOT NULL,
  body          TEXT NOT NULL,
  stock_code    VARCHAR(6) NULL,
  stock_name    VARCHAR(100) NULL,
  view_count    INT NOT NULL DEFAULT 0,
  like_count    INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_community_list (board, created_at DESC),
  KEY idx_community_likes (like_count DESC, created_at DESC),
  KEY idx_community_comments (comment_count DESC, created_at DESC),
  KEY idx_community_user (user_id, created_at DESC),
  CONSTRAINT fk_community_post_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_post_likes (
  post_id    BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  KEY idx_community_like_user (user_id, created_at DESC),
  CONSTRAINT fk_community_like_post FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_community_like_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_comments (
  comment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id    BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_community_comment_post (post_id, created_at ASC),
  KEY idx_community_comment_user (user_id, created_at DESC),
  CONSTRAINT fk_community_comment_post FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_community_comment_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_post_attachments (
  attachment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id       BIGINT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  file_size     INT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_community_attach_post (post_id),
  CONSTRAINT fk_community_attach_post FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_post_polls (
  poll_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id    BIGINT NOT NULL,
  title      VARCHAR(100) NOT NULL DEFAULT '여러분의 생각은?',
  ends_at    DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_community_poll_post (post_id),
  KEY idx_community_poll_ends (ends_at),
  CONSTRAINT fk_community_poll_post FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_poll_options (
  option_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  poll_id    BIGINT NOT NULL,
  label      VARCHAR(50) NOT NULL,
  icon_type  ENUM('rise','fall','custom') NOT NULL DEFAULT 'custom',
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_community_poll_option_poll (poll_id),
  CONSTRAINT fk_community_poll_option_poll FOREIGN KEY (poll_id) REFERENCES community_post_polls(poll_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_poll_votes (
  vote_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
  poll_id    BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  option_id  BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_community_poll_vote (poll_id, user_id),
  KEY idx_community_poll_vote_poll (poll_id),
  KEY idx_community_poll_vote_user (user_id),
  CONSTRAINT fk_community_poll_vote_poll FOREIGN KEY (poll_id) REFERENCES community_post_polls(poll_id) ON DELETE CASCADE,
  CONSTRAINT fk_community_poll_vote_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_community_poll_vote_option FOREIGN KEY (option_id) REFERENCES community_poll_options(option_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 11. 고객센터 문의 ─────────────────────────────────────────
CREATE TABLE support_inquiries (
  inquiry_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT NOT NULL,
  category   VARCHAR(30) NOT NULL COMMENT 'investment|service|payment|account|other',
  title      VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  status     ENUM('waiting', 'answered', 'resolved') NOT NULL DEFAULT 'waiting',
  is_private TINYINT(1) NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_support_inq_list (is_private, status, created_at DESC),
  KEY idx_support_inq_user (user_id, created_at DESC),
  KEY idx_support_inq_category (category),
  CONSTRAINT fk_support_inq_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_inquiry_replies (
  reply_id   BIGINT PRIMARY KEY AUTO_INCREMENT,
  inquiry_id BIGINT NOT NULL,
  admin_name VARCHAR(80) NOT NULL DEFAULT '주린닷컴 고객센터',
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_support_reply_inquiry (inquiry_id, created_at ASC),
  CONSTRAINT fk_support_reply_inquiry FOREIGN KEY (inquiry_id) REFERENCES support_inquiries(inquiry_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_inquiry_feedback (
  inquiry_id BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  helpful    TINYINT(1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inquiry_id, user_id),
  CONSTRAINT fk_support_fb_inquiry FOREIGN KEY (inquiry_id) REFERENCES support_inquiries(inquiry_id) ON DELETE CASCADE,
  CONSTRAINT fk_support_fb_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_inquiry_attachments (
  attachment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  inquiry_id    BIGINT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  file_size     INT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_support_attach_inquiry (inquiry_id),
  CONSTRAINT fk_support_attach_inquiry FOREIGN KEY (inquiry_id) REFERENCES support_inquiries(inquiry_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
