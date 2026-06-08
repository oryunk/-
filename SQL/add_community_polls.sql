USE stock_db;

CREATE TABLE IF NOT EXISTS community_post_polls (
  poll_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id    BIGINT NOT NULL,
  title      VARCHAR(100) NOT NULL DEFAULT '여러분의 생각은?',
  ends_at    DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_community_poll_post (post_id),
  KEY idx_community_poll_ends (ends_at),
  CONSTRAINT fk_community_poll_post FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_poll_votes (
  vote_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
  poll_id    BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  choice     ENUM('rise','fall') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_community_poll_vote (poll_id, user_id),
  KEY idx_community_poll_vote_poll (poll_id),
  KEY idx_community_poll_vote_user (user_id),
  CONSTRAINT fk_community_poll_vote_poll FOREIGN KEY (poll_id) REFERENCES community_post_polls(poll_id) ON DELETE CASCADE,
  CONSTRAINT fk_community_poll_vote_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
