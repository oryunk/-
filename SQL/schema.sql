CREATE DATABASE IF NOT EXISTS stock_db;
USE stock_db;

# 1. 사용자
CREATE TABLE users(
  user_id        BIGINT PRIMARY KEY AUTO_INCREMENT, -- 사용자 id
  email          VARCHAR(100) NOT NULL UNIQUE,      -- 이메일
  password_hash  VARCHAR(255) NOT NULL,             -- 패스워드_해시값 저장
  nickname       VARCHAR(50)  NOT NULL,             -- 닉네임(별명)
  created_at     DATETIME     NOT NULL,             -- 가입 일시
  updated_at     DATETIME     NOT NULL              -- 수정 일시
);

# 2. 종목 / 시세 / 인기
# 종목 기본 정보
CREATE TABLE stocks (
  stock_id   BIGINT PRIMARY KEY AUTO_INCREMENT,  -- 종목 id
  symbol     VARCHAR(20)  NOT NULL UNIQUE,       -- 종목 코드
  name_ko    VARCHAR(100) NOT NULL,              -- 한글 종목명
  name_en    VARCHAR(100),                       -- 영어 종목명
  market     VARCHAR(20),                        -- 시장 ex) KOSPI, KOSDAQ, NASDAQ...
  sector     VARCHAR(50),                        -- 섹터/업종
  is_active  TINYINT(1) NOT NULL DEFAULT 1,      -- 사용 여부
  created_at DATETIME NOT NULL,                  -- 생성 일시
  updated_at DATETIME NOT NULL                   -- 가입 일시
);

# 종목 일별 시세 (필요 시 부분 저장)
CREATE TABLE stock_price_daily (
  price_id    BIGINT PRIMARY KEY AUTO_INCREMENT,     -- 시세 id
  stock_id    BIGINT NOT NULL,                       -- 종목 id
  date   DATE   NOT NULL,                            -- 기준 일자
  open_price  DECIMAL(15,2),                         -- 시가
  high_price  DECIMAL(15,2),                         -- 고가
  low_price   DECIMAL(15,2),                         -- 저가
  close_price DECIMAL(15,2),                         -- 종가
  volume      BIGINT,                                -- 거래량 
  created_at  DATETIME NOT NULL,                     -- 기록 생성 일시
  UNIQUE (stock_id, date),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) -- 참조
);

# 인기 종목 집계 (일단위)
CREATE TABLE stock_popularity (
  popularity_id BIGINT PRIMARY KEY AUTO_INCREMENT, -- 인기 집계 id
  stock_id      BIGINT NOT NULL,                   -- 종목 id
  date          DATE   NOT NULL,                   -- 기준 일자
  view_count    INT    NOT NULL DEFAULT 0,         -- 조회 수
  search_count  INT    NOT NULL DEFAULT 0,         -- 검색횟수 
  trade_count   INT    NOT NULL DEFAULT 0,         -- 모의거래 건수
  UNIQUE (stock_id, date),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
);

# 3. 모의투자 (계좌 / 보유 / 주문)
# 유저별 모의투자 계좌
CREATE TABLE virtual_accounts (
  account_id    BIGINT PRIMARY KEY AUTO_INCREMENT,  -- 계좌 id
  user_id       BIGINT NOT NULL,                    -- 사용자 id
  initial_cash  DECIMAL(18,2) NOT NULL,             -- 초기 자금
  cash_balance  DECIMAL(18,2) NOT NULL,             -- 현금 잔액
  created_at    DATETIME      NOT NULL,             -- 계좌 생성 일시 
  updated_at    DATETIME      NOT NULL,             -- 계좌 수정 일시
  UNIQUE(user_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

# 보유 종목
CREATE TABLE virtual_positions (
  position_id BIGINT PRIMARY KEY AUTO_INCREMENT,    -- 포지션 id
  account_id  BIGINT NOT NULL,                      -- 계좌 id
  stock_id    BIGINT NOT NULL,                      -- 종목 id
  quantity    INT    NOT NULL,                      -- 보유 수량
  avg_price   DECIMAL(18,2) NOT NULL,               -- 평균 매입 단가
  updated_at  DATETIME      NOT NULL,               -- 포지션 변경 일시
  UNIQUE (account_id, stock_id),
  FOREIGN KEY (account_id) REFERENCES virtual_accounts(account_id),
  FOREIGN KEY (stock_id)   REFERENCES stocks(stock_id)
);

# 주문
CREATE TABLE virtual_orders (
  order_id    BIGINT PRIMARY KEY AUTO_INCREMENT,         -- 주문 id
  account_id  BIGINT NOT NULL,							 -- 계좌 id	
  stock_id    BIGINT NOT NULL,							 -- 종목 id
  side        ENUM('BUY','SELL') NOT NULL,               -- 매수/매도 구분
  price       DECIMAL(18,2)      NOT NULL,               -- 주문 가격
  quantity    INT                NOT NULL,               -- 주문 수량
  status      ENUM('EXECUTED','CANCELED') NOT NULL,      -- 주문 상태
  fee_amount  DECIMAL(18, 2) NOT NULL,                   -- 수수료
  executed_at DATETIME NOT NULL,                         -- 체결 일시
  created_at  DATETIME NOT NULL,                         -- 주문 생성 일시
  FOREIGN KEY (account_id) REFERENCES virtual_accounts(account_id),
  FOREIGN KEY (stock_id)   REFERENCES stocks(stock_id),
  INDEX(account_id, created_at),                         -- 주문내역 최신순 목록
  INDEX(account_id, stock_id, created_at)                -- 종목별 체결내역 보기
);

# 4. AI 분석
CREATE TABLE ai_analyses (
  analysis_id BIGINT PRIMARY KEY AUTO_INCREMENT,  -- 분석 id
  user_id     BIGINT,                             -- 사용자 id(비로그인 허용 시 NULL 가능)
  stock_id    BIGINT,                             -- 종목 id
  target_type ENUM('STOCK','MARKET') NOT NULL,    -- 대상 유형
  target_key  VARCHAR(50),                        -- 대상 키('KOSPI' 등 시장 코드)
  rating      VARCHAR(50) NOT NULL,               -- ai의견(강력매수/매수/보유/중립...)
  per_text    VARCHAR(50),                        -- PER텍스트('14.2배' 같은 표현)
  summary     TEXT        NOT NULL,               -- 분석 요약(자연어 분석 결과)
  created_at  DATETIME    NOT NULL,               -- 분석 생성 일시
  FOREIGN KEY (user_id)  REFERENCES users(user_id),
  FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)
);

# 5. 뉴스 
CREATE TABLE news_articles (
  news_id      BIGINT PRIMARY KEY AUTO_INCREMENT,  				-- 뉴스 id
  title        VARCHAR(255) NOT NULL,              				-- 제목
  summary      TEXT,                               				-- 요약(RSS 본문 등)
  reader_digest TEXT NULL,                         				-- 사이트용 쉬운 설명(AI 생성 캐시)
  url          VARCHAR(500) NOT NULL,             				-- 원문 url
  guid         VARCHAR(255),                                    -- RSS guid
  img_url      VARCHAR(500),                                    -- 썸네일 이미지
  category     VARCHAR(50),                        				-- 카테고리(산업, 글로벌, ETF, 정책 등)
  source       VARCHAR(100) NOT NULL,                           -- 출처(연합뉴스, 블룸버그...)
  published_at DATETIME NOT NULL,                           	-- 기사 발행 일시
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,     -- 저장 일시
  fetched_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,     -- 서버 수집 일시
  
  UNIQUE KEY uq_news_url (url),                                 -- 중복 방지
  UNIQUE KEY uq_news_guid (source, guid),                       -- 중복 방지
  INDEX idx_news_published (published_at),                      -- 정렬/조회용 인덱스
  INDEX idx_news_category_published (category, published_at),   -- 카테고리별 최신 조회용 인덱스
  FULLTEXT KEY ft_news_title_summary (title, summary)           -- 제목/요약 검색용
);

#6. 용어사전
CREATE TABLE stock_terms (
  term_id     BIGINT PRIMARY KEY AUTO_INCREMENT,   -- 용어 id 
  term        VARCHAR(100) NOT NULL,               -- 용어 키(PER)
  full_name   VARCHAR(255),                        -- 용어 풀네임
  definition  TEXT        NOT NULL,                -- 정의  
  example     TEXT,                                -- 예시
  category    VARCHAR(50),                         -- 카테고리
  created_at  DATETIME    NOT NULL                 -- 등록 일시
); 

# 7. 뉴스 - 종목 매핑
CREATE TABLE news_stock_rel (
	news_id   BIGINT NOT NULL,                                        -- 뉴스 id
	stock_id  BIGINT NOT NULL,                                        -- 종목 id
	match_type ENUM('MANUAL','TICKER','NLP') NOT NULL DEFAULT 'NLP',  -- 매핑 방식(수동/티커/자연어)
	confidence DECIMAL(5,4),                                          -- 매핑 신뢰도(0~1)
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,           -- 매핑 생성 일시
  
	PRIMARY KEY (news_id, stock_id),                                  -- 중복 매핑 방지 
	INDEX idx_news_stock (stock_id, news_id),                         -- 종목별 뉴스 조회 최적화
 
	FOREIGN KEY (news_id) REFERENCES news_articles(news_id),          --  참조
	FOREIGN KEY (stock_id) REFERENCES stocks(stock_id)                --  참조
);

# 8. api 연동
CREATE TABLE api_tokens (
    token_id     INT PRIMARY KEY AUTO_INCREMENT,        -- 토큰 id
    token_type   VARCHAR(20) NOT NULL,          		-- 'KIS_ACCESS_TOKEN' 등
    access_token TEXT NOT NULL,                 		-- 발급받은 토큰 값
    expired_at   DATETIME NOT NULL,            			-- 만료 일시
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);






