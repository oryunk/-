USE stock_db;

CREATE TABLE IF NOT EXISTS support_inquiry_attachments (
  attachment_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  inquiry_id       BIGINT NOT NULL,
  original_name    VARCHAR(255) NOT NULL,
  stored_name      VARCHAR(255) NOT NULL,
  mime_type        VARCHAR(100) NOT NULL,
  file_size        INT NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_support_attach_inquiry (inquiry_id),
  CONSTRAINT fk_support_attach_inquiry FOREIGN KEY (inquiry_id) REFERENCES support_inquiries(inquiry_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
