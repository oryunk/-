USE stock_db;

-- 프로필 사진 기능 컬럼 (커스텀 업로드 + Google OAuth 기본 사진)
ALTER TABLE users
  ADD COLUMN profile_image_path VARCHAR(255) NULL
    COMMENT '프로필 이미지 저장 경로 (uploads/profile_images 기준)'
    AFTER nickname;

ALTER TABLE users
  ADD COLUMN google_picture_url VARCHAR(500) NULL
    COMMENT 'Google 계정 프로필 사진 URL'
    AFTER profile_image_path;
